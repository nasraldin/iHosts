import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { dialog, BrowserWindow } from "electron";
import { HostsParser } from "./hostsParser";
import { BackupManager } from "./backupManager";
import type { HostEntry, HostsFileData } from "../../types/ipc";

const execAsync = promisify(exec);
const HOSTS_FILE_PATH = "/etc/hosts";

export class HostsFileManager {
  private static readonly watcher: fs.FileHandle | null = null;

  /**
   * Read and parse hosts file
   */
  static async readHosts(): Promise<HostsFileData> {
    try {
      // Try to read without sudo first (might work if user has permissions)
      let content: string;
      try {
        content = await fs.readFile(HOSTS_FILE_PATH, "utf-8");
      } catch {
        // If that fails, use sudo
        const { stdout } = await execAsync(`cat ${HOSTS_FILE_PATH}`);
        content = stdout;
      }

      const entries = HostsParser.parse(content);
      const stats = await fs.stat(HOSTS_FILE_PATH);

      return {
        entries,
        rawLines: content.split("\n"),
        lastModified: stats.mtimeMs,
      };
    } catch (error) {
      console.error("Failed to read hosts file:", error);
      throw new Error(
        `Failed to read hosts file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Execute a command with administrator privileges using macOS native dialog
   * This shows a native macOS password prompt instead of terminal prompt
   */
  private static async execWithAdmin(command: string): Promise<string> {
    // Create a temporary script file to avoid complex escaping issues
    const scriptPath = path.join(os.tmpdir(), `hosts-admin-${Date.now()}.sh`);

    try {
      // Write the command to a script file
      await fs.writeFile(scriptPath, `#!/bin/bash\n${command}\n`, "utf-8");

      // Make the script executable
      await fs.chmod(scriptPath, 0o755);

      // Use osascript to execute the script with administrator privileges
      // This will show a native macOS password dialog (not terminal)
      const appleScript = `do shell script "${scriptPath}" with administrator privileges`;

      // Execute osascript - escape single quotes for shell
      const escapedAppleScript = appleScript.replaceAll("'", String.raw`'\''`);
      const { stdout, stderr } = await execAsync(
        `osascript -e '${escapedAppleScript}'`,
      );

      if (
        stderr &&
        !stderr.includes("password") &&
        !stderr.includes("Password:")
      ) {
        // stderr might contain warnings, but if it's not about password, log it
        console.warn("Command stderr:", stderr);
      }

      return stdout;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Check for user cancellation (user clicked Cancel in password dialog)
      if (
        errorMessage.includes("User canceled") ||
        errorMessage.includes("canceled") ||
        errorMessage.includes("User cancelled") ||
        errorMessage.includes("128")
      ) {
        throw new Error("Permission denied: User canceled the password prompt");
      }

      // Check for authentication failure
      if (
        errorMessage.includes("password") ||
        errorMessage.includes("authentication") ||
        errorMessage.includes("Authentication failed")
      ) {
        throw new Error(
          "Authentication failed: Please check your password and try again",
        );
      }

      throw new Error(`Command failed: ${errorMessage}`);
    } finally {
      // Clean up the temporary script file
      try {
        await fs.unlink(scriptPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Validate entries before writing
   */
  private static validateEntriesForWrite(entries: HostEntry[]): void {
    if (!Array.isArray(entries)) {
      throw new TypeError("Entries must be an array");
    }

    if (entries.length === 0) {
      throw new Error("Cannot save empty hosts file");
    }

    const validationErrors: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry || typeof entry !== "object") {
        validationErrors.push(`Entry ${i + 1}: Invalid entry object`);
        continue;
      }

      const validation = HostsParser.validateEntry(entry);
      if (!validation.valid) {
        validationErrors.push(
          `Entry ${i + 1}: ${validation.errors.join(", ")}`,
        );
      }
    }

    if (validationErrors.length > 0) {
      throw new Error(`Validation failed:\n${validationErrors.join("\n")}`);
    }
  }

  /**
   * Show permission dialog and get user confirmation
   */
  private static async requestPermission(
    window: BrowserWindow | null,
  ): Promise<void> {
    if (!window) {
      return;
    }

    const result = await dialog.showMessageBox(window, {
      type: "info",
      buttons: ["Cancel", "Continue"],
      defaultId: 1,
      title: "Administrator Access Required",
      message: "Administrator access required",
      detail:
        "This app needs administrator privileges to modify the hosts file. A password dialog will appear next.",
      cancelId: 0,
    });

    if (result.response === 0) {
      throw new Error("Permission denied: User canceled");
    }
  }

  /**
   * Create backup of current hosts file
   */
  private static async createBackupIfNeeded(): Promise<void> {
    try {
      const currentData = await this.readHosts();
      if (
        Array.isArray(currentData.entries) &&
        currentData.entries.length > 0
      ) {
        await BackupManager.createBackup(currentData.entries);
      }
    } catch (error) {
      // Log but don't fail if backup creation fails
      console.error("Failed to create backup (continuing anyway):", error);
    }
  }

  /**
   * Write content to hosts file using temporary file and admin privileges
   */
  private static async writeContentToHostsFile(content: string): Promise<void> {
    const tempPath = path.join(os.tmpdir(), `hosts-${Date.now()}.tmp`);

    try {
      await fs.writeFile(tempPath, content, "utf-8");
      await this.execWithAdmin(`cp "${tempPath}" "${HOSTS_FILE_PATH}"`);
      await fs.unlink(tempPath).catch(() => {
        // Ignore cleanup errors
      });
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Write hosts file with backup, validation, and native macOS password dialog
   */
  static async writeHosts(
    entries: HostEntry[],
    window: BrowserWindow | null = null,
  ): Promise<void> {
    this.validateEntriesForWrite(entries);
    await this.requestPermission(window);
    await this.createBackupIfNeeded();

    const content = HostsParser.stringify(entries);
    await this.writeContentToHostsFile(content);
  }

  /**
   * Watch hosts file for external changes
   */
  static async watchHosts(
    callback: (data: HostsFileData) => void,
  ): Promise<() => void> {
    // Polling approach since /etc/hosts requires sudo to watch
    let lastModified = 0;

    const pollInterval = setInterval(async () => {
      try {
        const stats = await fs.stat(HOSTS_FILE_PATH);
        if (stats.mtimeMs !== lastModified) {
          lastModified = stats.mtimeMs;
          const data = await this.readHosts();
          callback(data);
        }
      } catch (error) {
        console.error("Error watching hosts file:", error);
      }
    }, 2000); // Poll every 2 seconds

    return () => {
      clearInterval(pollInterval);
    };
  }
}
