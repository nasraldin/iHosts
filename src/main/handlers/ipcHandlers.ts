import { ipcMain, BrowserWindow } from "electron";
import { HostsFileManager } from "../services/hostsFileManager";
import { BackupManager } from "../services/backupManager";
import { ProfileManager } from "../services/profileManager";
import type {
  IPCResponse,
  HostEntry,
  BackupInfo,
  Profile,
} from "../../types/ipc";

// Get the main window instance
function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : null;
}

export function setupIpcHandlers(): void {
  // Hosts file operations
  ipcMain.handle(
    "hosts:read",
    async (): Promise<
      IPCResponse<
        ReturnType<typeof HostsFileManager.readHosts> extends Promise<infer T>
          ? T
          : never
      >
    > => {
      try {
        const data = await HostsFileManager.readHosts();
        return { success: true, data };
      } catch (error) {
        console.error("hosts:read error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  ipcMain.handle(
    "hosts:write",
    async (_event, entries: HostEntry[]): Promise<IPCResponse<void>> => {
      try {
        // Validate entries parameter
        if (!entries) {
          return {
            success: false,
            error: "Entries parameter is required",
          };
        }

        if (!Array.isArray(entries)) {
          return {
            success: false,
            error: `Entries must be an array, got: ${typeof entries}`,
          };
        }

        if (entries.length === 0) {
          return {
            success: false,
            error: "Cannot save empty hosts file",
          };
        }

        // Get main window for permission dialog
        const window = getMainWindow();

        // Write hosts file (this will request sudo permission)
        await HostsFileManager.writeHosts(entries, window);

        return { success: true };
      } catch (error) {
        console.error("hosts:write error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Backup operations
  ipcMain.handle(
    "backup:create",
    async (): Promise<IPCResponse<BackupInfo>> => {
      try {
        const current = await HostsFileManager.readHosts();
        const backup = await BackupManager.createBackup(current.entries);
        return { success: true, data: backup };
      } catch (error) {
        console.error("backup:create error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  ipcMain.handle(
    "backup:list",
    async (): Promise<IPCResponse<BackupInfo[]>> => {
      try {
        const backups = await BackupManager.listBackups();
        return { success: true, data: backups };
      } catch (error) {
        console.error("backup:list error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  ipcMain.handle(
    "backup:restore",
    async (_event, backupId: string): Promise<IPCResponse<void>> => {
      try {
        const entries = await BackupManager.restoreBackup(backupId);
        const window = getMainWindow();
        await HostsFileManager.writeHosts(entries, window);
        return { success: true };
      } catch (error) {
        console.error("backup:restore error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  ipcMain.handle(
    "backup:read",
    async (_event, backupId: string): Promise<IPCResponse<HostEntry[]>> => {
      try {
        const entries = await BackupManager.restoreBackup(backupId);
        return { success: true, data: entries };
      } catch (error) {
        console.error("backup:read error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  ipcMain.handle(
    "backup:delete",
    async (_event, backupId: string): Promise<IPCResponse<void>> => {
      try {
        await BackupManager.deleteBackup(backupId);
        return { success: true };
      } catch (error) {
        console.error("backup:delete error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  // Profile operations
  ipcMain.handle("profile:list", async (): Promise<IPCResponse<Profile[]>> => {
    try {
      const profiles = await ProfileManager.listProfiles();
      return { success: true, data: profiles };
    } catch (error) {
      console.error("profile:list error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  ipcMain.handle(
    "profile:save",
    async (
      _event,
      profile: Omit<Profile, "id" | "createdAt" | "updatedAt">,
    ): Promise<IPCResponse<Profile>> => {
      try {
        const savedProfile = await ProfileManager.saveProfile(profile);
        return { success: true, data: savedProfile };
      } catch (error) {
        console.error("profile:save error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  ipcMain.handle(
    "profile:load",
    async (_event, profileId: string): Promise<IPCResponse<Profile>> => {
      try {
        const profile = await ProfileManager.loadProfile(profileId);
        return { success: true, data: profile };
      } catch (error) {
        console.error("profile:load error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  ipcMain.handle(
    "profile:delete",
    async (_event, profileId: string): Promise<IPCResponse<void>> => {
      try {
        await ProfileManager.deleteProfile(profileId);
        return { success: true };
      } catch (error) {
        console.error("profile:delete error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );
}
