import { contextBridge, ipcRenderer } from "electron";
import type {
  HostsFileData,
  HostEntry,
  BackupInfo,
  Profile,
  IPCResponse,
} from "./types/ipc";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Hosts file operations
  readHosts: (): Promise<IPCResponse<HostsFileData>> =>
    ipcRenderer.invoke("hosts:read"),

  writeHosts: (entries: HostEntry[]): Promise<IPCResponse<void>> => {
    // Validate and serialize entries
    if (!Array.isArray(entries)) {
      return Promise.resolve({
        success: false,
        error: "Entries must be an array",
      });
    }

    // Ensure all entries are plain serializable objects
    const serializableEntries: HostEntry[] = entries.map((entry) => ({
      id: String(entry.id || ""),
      ip: String(entry.ip || ""),
      hostnames: Array.isArray(entry.hostnames)
        ? entry.hostnames.map(String)
        : [],
      enabled: Boolean(entry.enabled),
      comment: entry.comment ? String(entry.comment) : undefined,
      group: entry.group ? String(entry.group) : undefined,
    }));

    return ipcRenderer.invoke("hosts:write", serializableEntries);
  },

  watchHosts: (callback: (data: HostsFileData) => void) => {
    ipcRenderer.on("hosts:changed", (_event, data: HostsFileData) =>
      callback(data),
    );
    return () => ipcRenderer.removeAllListeners("hosts:changed");
  },

  // Backup operations
  createBackup: (): Promise<IPCResponse<BackupInfo>> =>
    ipcRenderer.invoke("backup:create"),

  listBackups: (): Promise<IPCResponse<BackupInfo[]>> =>
    ipcRenderer.invoke("backup:list"),

  restoreBackup: (backupId: string): Promise<IPCResponse<void>> =>
    ipcRenderer.invoke("backup:restore", backupId),

  readBackup: (backupId: string): Promise<IPCResponse<HostEntry[]>> =>
    ipcRenderer.invoke("backup:read", backupId),

  deleteBackup: (backupId: string): Promise<IPCResponse<void>> =>
    ipcRenderer.invoke("backup:delete", backupId),

  // Profile operations
  listProfiles: (): Promise<IPCResponse<Profile[]>> =>
    ipcRenderer.invoke("profile:list"),

  saveProfile: (
    profile: Omit<Profile, "id" | "createdAt" | "updatedAt">,
  ): Promise<IPCResponse<Profile>> =>
    ipcRenderer.invoke("profile:save", profile),

  loadProfile: (profileId: string): Promise<IPCResponse<Profile>> =>
    ipcRenderer.invoke("profile:load", profileId),

  deleteProfile: (profileId: string): Promise<IPCResponse<void>> =>
    ipcRenderer.invoke("profile:delete", profileId),

  // Menu message handlers
  onMenuNewEntry: (callback: () => void) => {
    ipcRenderer.on("menu:new-entry", () => callback());
    return () => ipcRenderer.removeAllListeners("menu:new-entry");
  },
  onMenuSave: (callback: () => void) => {
    ipcRenderer.on("menu:save", () => callback());
    return () => ipcRenderer.removeAllListeners("menu:save");
  },
});

// Type definitions for the exposed API
export type ElectronAPI = {
  readHosts: () => Promise<IPCResponse<HostsFileData>>;
  writeHosts: (entries: HostEntry[]) => Promise<IPCResponse<void>>;
  watchHosts: (callback: (data: HostsFileData) => void) => () => void;
  createBackup: () => Promise<IPCResponse<BackupInfo>>;
  listBackups: () => Promise<IPCResponse<BackupInfo[]>>;
  restoreBackup: (backupId: string) => Promise<IPCResponse<void>>;
  readBackup: (backupId: string) => Promise<IPCResponse<HostEntry[]>>;
  deleteBackup: (backupId: string) => Promise<IPCResponse<void>>;
  listProfiles: () => Promise<IPCResponse<Profile[]>>;
  saveProfile: (
    profile: Omit<Profile, "id" | "createdAt" | "updatedAt">,
  ) => Promise<IPCResponse<Profile>>;
  loadProfile: (profileId: string) => Promise<IPCResponse<Profile>>;
  deleteProfile: (profileId: string) => Promise<IPCResponse<void>>;
  onMenuNewEntry: (callback: () => void) => () => void;
  onMenuSave: (callback: () => void) => () => void;
};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
  // eslint-disable-next-line no-var
  var electronAPI: ElectronAPI;
}
