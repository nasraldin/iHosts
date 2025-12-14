import { app } from "electron";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { BackupInfo, HostEntry } from "../../types/ipc";

export class BackupManager {
  private static backupDir: string;

  static async initialize(): Promise<void> {
    const userDataPath = app.getPath("userData");
    this.backupDir = path.join(userDataPath, "backups");

    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create backup directory:", error);
      throw error;
    }
  }

  static async createBackup(entries: HostEntry[]): Promise<BackupInfo> {
    if (!Array.isArray(entries)) {
      throw new TypeError(
        `Entries must be an array for backup, got: ${typeof entries}`,
      );
    }

    const timestamp = Date.now();
    const backupId = `backup-${timestamp}`;
    const backupPath = path.join(this.backupDir, `${backupId}.json`);

    const backupData = {
      timestamp,
      entries,
      version: "1.0.0",
    };

    await fs.writeFile(
      backupPath,
      JSON.stringify(backupData, null, 2),
      "utf-8",
    );

    return {
      id: backupId,
      timestamp,
      path: backupPath,
      entryCount: entries.length,
    };
  }

  static async listBackups(): Promise<BackupInfo[]> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups: BackupInfo[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, "utf-8");
          const data = JSON.parse(content);

          backups.push({
            id: path.basename(file, ".json"),
            timestamp: data.timestamp || stats.mtimeMs,
            path: filePath,
            entryCount: data.entries?.length || 0,
          });
        }
      }

      // Sort by timestamp (newest first)
      return backups.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error("Failed to list backups:", error);
      return [];
    }
  }

  static async restoreBackup(backupId: string): Promise<HostEntry[]> {
    const backupPath = path.join(this.backupDir, `${backupId}.json`);

    try {
      const content = await fs.readFile(backupPath, "utf-8");
      const data = JSON.parse(content);

      if (!data.entries || !Array.isArray(data.entries)) {
        throw new Error("Invalid backup format");
      }

      return data.entries;
    } catch (error) {
      console.error("Failed to restore backup:", error);
      throw new Error(
        `Failed to restore backup: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  static async deleteBackup(backupId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, `${backupId}.json`);
    await fs.unlink(backupPath);
  }

  static async cleanupOldBackups(keepCount = 50): Promise<void> {
    const backups = await this.listBackups();

    if (backups.length <= keepCount) {
      return;
    }

    const toDelete = backups.slice(keepCount);
    for (const backup of toDelete) {
      await this.deleteBackup(backup.id);
    }
  }
}
