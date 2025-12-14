export interface HostEntry {
  id: string;
  ip: string;
  hostnames: string[];
  enabled: boolean;
  comment?: string;
  group?: string;
}

export interface HostsFileData {
  entries: HostEntry[];
  rawLines: string[];
  lastModified: number;
}

export interface BackupInfo {
  id: string;
  timestamp: number;
  path: string;
  entryCount: number;
}

export interface Profile {
  id: string;
  name: string;
  entries: HostEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
