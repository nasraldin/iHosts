import React, { useEffect, useState } from "react";
import { useHostsStore } from "../store/useHostsStore";
import type { BackupInfo, HostEntry } from "../../types/ipc";

export const BackupManager: React.FC = () => {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [backupEntries, setBackupEntries] = useState<HostEntry[]>([]);
  const [loadingBackup, setLoadingBackup] = useState(false);
  const currentEntries = useHostsStore((state) => state.entries);

  // Load backups list
  useEffect(() => {
    const loadBackups = async () => {
      setLoading(true);
      try {
        const response = await globalThis.electronAPI.listBackups();
        if (response.success && response.data) {
          setBackups(response.data);
        }
      } catch (error) {
        console.error("Failed to load backups:", error);
      } finally {
        setLoading(false);
      }
    };

    loadBackups();
  }, []);

  // Load backup entries when selected
  const loadBackupEntries = async (backup: BackupInfo) => {
    setLoadingBackup(true);
    setSelectedBackup(backup);
    try {
      const response = await globalThis.electronAPI.readBackup(backup.id);
      if (response.success && response.data) {
        setBackupEntries(response.data);
      }
    } catch (error) {
      console.error("Failed to load backup entries:", error);
    } finally {
      setLoadingBackup(false);
    }
  };

  const handleRestore = async (backup: BackupInfo) => {
    if (
      !confirm(
        `Are you sure you want to restore backup from ${new Date(backup.timestamp).toLocaleString()}? This will replace your current hosts file.`,
      )
    ) {
      return;
    }

    try {
      const response = await globalThis.electronAPI.restoreBackup(backup.id);
      if (response.success) {
        // Reload current entries
        const hostsResponse = await globalThis.electronAPI.readHosts();
        if (hostsResponse.success && hostsResponse.data) {
          useHostsStore.getState().setEntries(hostsResponse.data.entries);
        }
        alert("Backup restored successfully!");
      } else {
        alert(`Failed to restore backup: ${response.error}`);
      }
    } catch (error) {
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const handleDelete = async (backup: BackupInfo) => {
    if (
      !confirm(
        `Are you sure you want to delete backup from ${new Date(backup.timestamp).toLocaleString()}?`,
      )
    ) {
      return;
    }

    try {
      const response = await globalThis.electronAPI.deleteBackup(backup.id);
      if (response.success) {
        // Reload backups list
        const listResponse = await globalThis.electronAPI.listBackups();
        if (listResponse.success && listResponse.data) {
          setBackups(listResponse.data);
        }
        if (selectedBackup?.id === backup.id) {
          setSelectedBackup(null);
          setBackupEntries([]);
        }
      } else {
        alert(`Failed to delete backup: ${response.error}`);
      }
    } catch (error) {
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Helper to get enabled status indicator for modified entries
  const getEnabledStatusIndicator = (
    entry: HostEntry,
    backupEntries: HostEntry[],
  ): string | null => {
    const sortedEntryHostnames = [...entry.hostnames].sort(
      (a: string, b: string) => a.localeCompare(b),
    );
    const sortedEntryKey = sortedEntryHostnames.join(",");
    const backupEntry = backupEntries.find((be) => {
      if (be.ip !== entry.ip) return false;
      const sortedBackupHostnames = [...be.hostnames].sort(
        (a: string, b: string) => a.localeCompare(b),
      );
      return sortedBackupHostnames.join(",") === sortedEntryKey;
    });
    if (backupEntry && entry.enabled !== backupEntry.enabled) {
      return entry.enabled ? "enabled" : "disabled";
    }
    return null;
  };

  // Compare entries
  const compareEntries = (current: HostEntry[], backup: HostEntry[]) => {
    // Create maps for comparison by IP+hostnames (since IDs may differ)
    const createKey = (e: HostEntry) => {
      const sortedHostnames = [...e.hostnames].sort((a: string, b: string) =>
        a.localeCompare(b),
      );
      return `${e.ip}-${sortedHostnames.join(",")}`;
    };
    const currentMap = new Map(current.map((e) => [createKey(e), e]));
    const backupMap = new Map(backup.map((e) => [createKey(e), e]));

    const added = current.filter((e) => !backupMap.has(createKey(e)));
    const removed = backup.filter((e) => !currentMap.has(createKey(e)));

    // Find modified entries (same IP+hostnames but different properties)
    const modified = current.filter((e) => {
      const backupEntry = backupMap.get(createKey(e));
      if (!backupEntry) return false;

      // Compare all properties except ID
      return (
        e.enabled !== backupEntry.enabled ||
        e.comment !== backupEntry.comment ||
        e.group !== backupEntry.group
      );
    });

    return { added, removed, modified };
  };

  const comparison =
    selectedBackup && backupEntries.length > 0
      ? compareEntries(currentEntries, backupEntries)
      : null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-semibold mb-1">Backup Manager</h2>
          <p className="text-sm text-muted-foreground">
            View, compare, and restore backups of your hosts file
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backups List */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Backups</h3>

          {(() => {
            if (loading) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  Loading backups...
                </div>
              );
            }
            if (backups.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="mb-2">No backups found</p>
                  <p className="text-sm">
                    Backups are created automatically when you save changes
                  </p>
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {backups.map((backup) => (
                  <button
                    key={backup.id}
                    type="button"
                    className={`w-full text-left p-4 rounded-lg border transition-all cursor-pointer ${
                      selectedBackup?.id === backup.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => loadBackupEntries(backup)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium">
                          {formatDate(backup.timestamp)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {backup.entryCount}{" "}
                          {backup.entryCount === 1 ? "entry" : "entries"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(backup);
                          }}
                          className="px-3 py-1 rounded text-sm border border-border hover:bg-secondary transition-colors"
                          title="Restore this backup"
                        >
                          ↻ Restore
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(backup);
                          }}
                          className="px-3 py-1 rounded text-sm border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete this backup"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Comparison View */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Comparison</h3>

          {(() => {
            if (!selectedBackup) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  Select a backup to compare with current hosts file
                </div>
              );
            }
            if (loadingBackup) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  Loading backup...
                </div>
              );
            }
            if (!comparison) {
              return null;
            }
            return (
              <div className="space-y-4">
                {/* Added Entries */}
                {comparison.added.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">
                      Added ({comparison.added.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {comparison.added.map((entry) => (
                        <div
                          key={entry.id}
                          className="p-2 rounded bg-green-500/10 border border-green-500/20 text-sm"
                        >
                          <span className="font-mono">{entry.ip}</span> →{" "}
                          {entry.hostnames.join(", ")}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Removed Entries */}
                {comparison.removed.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                      Removed ({comparison.removed.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {comparison.removed.map((entry) => {
                        const entryKey = `${entry.ip}-${entry.hostnames.join(",")}`;
                        return (
                          <div
                            key={entryKey}
                            className="p-2 rounded bg-red-500/10 border border-red-500/20 text-sm line-through"
                          >
                            <span className="font-mono">{entry.ip}</span> →{" "}
                            {entry.hostnames.join(", ")}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Modified Entries */}
                {comparison.modified.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">
                      Modified ({comparison.modified.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {comparison.modified.map((entry) => (
                        <div
                          key={entry.id}
                          className="p-2 rounded bg-orange-500/10 border border-orange-500/20 text-sm"
                        >
                          <span className="font-mono">{entry.ip}</span> →{" "}
                          {entry.hostnames.join(", ")}
                          {(() => {
                            const status = getEnabledStatusIndicator(
                              entry,
                              backupEntries,
                            );
                            return status ? (
                              <span className="ml-2 text-xs">({status})</span>
                            ) : null;
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {comparison.added.length === 0 &&
                  comparison.removed.length === 0 &&
                  comparison.modified.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No differences found. Current hosts file matches this
                      backup.
                    </div>
                  )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
