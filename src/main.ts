/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
import { app, BrowserWindow, dialog, Menu, shell } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { setupIpcHandlers } from "./main/handlers/ipcHandlers";
import { BackupManager } from "./main/services/backupManager";
import { ProfileManager } from "./main/services/profileManager";
import { HostsFileManager } from "./main/services/hostsFileManager";

// Set app name early (before app.whenReady)
app.setName("iHosts");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Suppress harmless DevTools errors at the process level
// These errors come from Chromium's DevTools and can't be fully suppressed,
// but we can filter them from stderr output
const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (
  chunk: string | Buffer | Uint8Array,
  encoding?: NodeJS.BufferEncoding | ((error?: Error | null) => void),
  callback?: (error?: Error | null) => void,
): boolean => {
  if (chunk) {
    const message = chunk.toString();
    // Filter out harmless autofill and GPU errors from DevTools
    if (
      message.includes("Autofill.enable") ||
      message.includes("Autofill.setAddresses") ||
      message.includes("SharedImageManager") ||
      message.includes("Invalid mailbox") ||
      message.includes("ProduceOverlay") ||
      message.includes("devtools://devtools")
    ) {
      // Suppress these errors silently
      if (typeof callback === "function") {
        callback();
      } else if (typeof encoding === "function") {
        encoding();
      }
      return true;
    }
  }
  // Log other errors normally
  // Handle the case where encoding might be a callback function
  if (typeof encoding === "function") {
    return originalStderrWrite(chunk, encoding);
  }
  if (callback) {
    return originalStderrWrite(chunk, encoding, callback);
  }
  return originalStderrWrite(chunk, encoding);
};

let mainWindow: BrowserWindow | null = null;
let hostsWatcher: (() => void) | null = null;
let pendingDialog: Promise<boolean> | null = null; // Track pending dialog to prevent duplicates

// Helper function to check for unsaved changes
async function checkUnsavedChanges(window: BrowserWindow): Promise<boolean> {
  try {
    const hasUnsaved = await window.webContents.executeJavaScript(`
      (() => {
        try {
          const store = window.__hostsStore;
          if (!store || !store.getState) return false;
          const state = store.getState();
          const entries = state.entries || [];
          const originalEntries = state.originalEntries || [];

          const isEntryUnsaved = (entry) => {
            const original = originalEntries.find(e => e.id === entry.id);
            if (!original) return true;
            return entry.ip !== original.ip ||
              JSON.stringify([...entry.hostnames].sort()) !== JSON.stringify([...original.hostnames].sort()) ||
              entry.enabled !== original.enabled ||
              entry.comment !== original.comment ||
              entry.group !== original.group;
          };

          return entries.some(e => isEntryUnsaved(e));
        } catch (e) {
          return false;
        }
      })()
    `);
    return hasUnsaved;
  } catch (error) {
    console.error("Error checking for unsaved changes:", error);
    return false;
  }
}

// Helper function to discard unsaved changes in the renderer
async function discardUnsavedChanges(window: BrowserWindow): Promise<void> {
  try {
    const result = await window.webContents.executeJavaScript(`
      (() => {
        try {
          const store = window.__hostsStore;
          if (store && store.getState) {
            const state = store.getState();
            if (state.discardChanges) {
              state.discardChanges();
              // Verify the discard worked
              const newState = store.getState();
              const hasUnsaved = (newState.entries || []).some(entry => {
                const original = (newState.originalEntries || []).find(e => e.id === entry.id);
                if (!original) return true;
                return entry.ip !== original.ip ||
                  JSON.stringify([...entry.hostnames].sort()) !== JSON.stringify([...original.hostnames].sort()) ||
                  entry.enabled !== original.enabled ||
                  entry.comment !== original.comment ||
                  entry.group !== original.group;
              });
              return { success: true, hasUnsaved };
            }
          }
          return { success: false, error: 'discardChanges method not found' };
        } catch (e) {
          console.error('Error discarding changes:', e);
          return { success: false, error: e.message };
        }
      })()
    `);
    if (result?.hasUnsaved) {
      // Log warning only in development
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "Warning: After discarding, there are still unsaved changes",
        );
      }
    }
  } catch (error) {
    console.error("Error discarding unsaved changes:", error);
  }
}

// Helper function to show unsaved changes dialog (only one at a time)
async function showUnsavedChangesDialog(
  window: BrowserWindow,
  action: "close" | "reload",
): Promise<boolean> {
  // If there's already a pending dialog, wait for it and return its result
  if (pendingDialog) {
    return await pendingDialog;
  }

  // Check for unsaved changes first
  const hasUnsaved = await checkUnsavedChanges(window);

  if (!hasUnsaved) {
    return true; // No unsaved changes, allow action
  }

  // Create the dialog promise
  pendingDialog = (async () => {
    try {
      const actionText = action === "close" ? "close the window" : "reload";
      const choice = dialog.showMessageBoxSync(window, {
        type: "warning",
        buttons: ["Discard Changes", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        title: "Unsaved Changes",
        message: "You have unsaved entries",
        detail: `If you ${actionText}, your unsaved changes will be lost. Do you want to discard your changes?`,
      });

      // If user clicked "Discard Changes", discard them and proceed
      if (choice === 0) {
        await discardUnsavedChanges(window);
        // Wait a bit to ensure discard is processed
        await new Promise((resolve) => setTimeout(resolve, 100));
        // Verify that changes were actually discarded
        const stillHasUnsaved = await checkUnsavedChanges(window);
        if (stillHasUnsaved && process.env.NODE_ENV === "development") {
          console.warn(
            "Warning: Changes were not fully discarded, but proceeding anyway",
          );
        }
        return true; // Proceed with action
      }

      // User clicked Cancel
      return false;
    } finally {
      // Clear the pending dialog after a short delay
      setTimeout(() => {
        pendingDialog = null;
      }, 200);
    }
  })();

  return await pendingDialog;
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // Suppress common harmless console errors
      enableWebSQL: false,
      // Security: Enable web security
      webSecurity: true,
    },
  });

  // Also filter console messages from webContents (new event format)
  mainWindow.webContents.on("console-message", (event) => {
    const message = String(event.message || "");
    const source = String(event.sourceId || "");

    // Filter out harmless autofill and GPU errors
    if (
      message.includes("Autofill.enable") ||
      message.includes("Autofill.setAddresses") ||
      message.includes("SharedImageManager") ||
      message.includes("Invalid mailbox") ||
      message.includes("ProduceOverlay") ||
      source.includes("devtools://devtools")
    ) {
      // Suppress these errors
      return;
    }
  });

  // Load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Setup hosts file watcher
  HostsFileManager.watchHosts((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("hosts:changed", data);
    }
  }).then((cleanup) => {
    hostsWatcher = cleanup;
  });

  // Prevent window close if there are unsaved changes
  mainWindow.on("close", async (event) => {
    if (mainWindow) {
      const shouldProceed = await showUnsavedChangesDialog(mainWindow, "close");
      if (!shouldProceed) {
        event.preventDefault();
      }
    }
  });

  // Handle reload - use will-prevent-unload for all reload scenarios (Cmd+R, menu, etc.)
  mainWindow.webContents.on("will-prevent-unload", async (event) => {
    if (mainWindow) {
      const shouldProceed = await showUnsavedChangesDialog(
        mainWindow,
        "reload",
      );
      if (!shouldProceed) {
        event.preventDefault();
      }
      // If shouldProceed is true, don't prevent - reload will happen automatically
    }
  });
};

// Create application menu
const createMenu = () => {
  const appName = app.getName();
  const version = app.getVersion();
  const author = "Nasr Aldin";
  const githubUrl = "https://github.com/nasraldin/iHosts";

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: appName,
      submenu: [
        {
          label: `About ${appName}`,
          click: () => {
            dialog
              .showMessageBox(mainWindow!, {
                type: "info",
                title: `About ${appName}`,
                message: appName,
                detail: `Version ${version}\n\n${appName} - Modern macOS hosts file manager with elegant UI\n\nAuthor: ${author}\nLicense: MIT`,
                buttons: ["GitHub", "OK"],
                defaultId: 1,
                cancelId: 1,
              })
              .then((result) => {
                if (result.response === 0) {
                  // User clicked GitHub button
                  shell.openExternal(githubUrl);
                }
              });
          },
        },
        { type: "separator" },
        {
          label: "Preferences...",
          accelerator: "CommandOrControl+,",
          click: () => {},
        },
        { type: "separator" },
        {
          role: "services",
          label: "Services",
        },
        { type: "separator" },
        {
          role: "hide",
          label: `Hide ${appName}`,
        },
        {
          role: "hideOthers",
        },
        {
          role: "unhide",
        },
        { type: "separator" },
        {
          role: "quit",
          label: `Quit ${appName}`,
        },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "New Entry",
          accelerator: "CommandOrControl+N",
          click: () => {
            // Send message to renderer to add new entry
            mainWindow?.webContents.send("menu:new-entry");
          },
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CommandOrControl+S",
          click: () => {
            mainWindow?.webContents.send("menu:save");
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo", label: "Undo" },
        { role: "redo", label: "Redo" },
        { type: "separator" },
        { role: "cut", label: "Cut" },
        { role: "copy", label: "Copy" },
        { role: "paste", label: "Paste" },
        { role: "selectAll", label: "Select All" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload", label: "Reload" },
        { role: "forceReload", label: "Force Reload" },
        { role: "toggleDevTools", label: "Toggle Developer Tools" },
        { type: "separator" },
        { role: "resetZoom", label: "Actual Size" },
        { role: "zoomIn", label: "Zoom In" },
        { role: "zoomOut", label: "Zoom Out" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Toggle Full Screen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize", label: "Minimize" },
        { role: "close", label: "Close" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "GitHub Repository",
          click: () => {
            shell.openExternal(githubUrl);
          },
        },
        {
          label: "Report Issue",
          click: () => {
            shell.openExternal(`${githubUrl}/issues`);
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// Initialize services and setup IPC handlers

app.whenReady().then(async () => {
  try {
    await BackupManager.initialize();
    await ProfileManager.initialize();
    setupIpcHandlers();
    createMenu();
    createWindow();
  } catch (error) {
    console.error("Failed to initialize app:", error);
    app.quit();
  }
});

// Quit when all windows are closed, except on macOS.
app.on("window-all-closed", () => {
  if (hostsWatcher) {
    hostsWatcher();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  if (hostsWatcher) {
    hostsWatcher();
  }
});
