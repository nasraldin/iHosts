import React, { useCallback } from "react";
import { useHostsStore } from "../store/useHostsStore";
import { useToast } from "./Toast";

export const Header: React.FC = () => {
  const entries = useHostsStore((state) => state.entries);
  const darkMode = useHostsStore((state) => state.darkMode);
  const toggleDarkMode = useHostsStore((state) => state.toggleDarkMode);
  const addEntry = useHostsStore((state) => state.addEntry);
  const markAsSaved = useHostsStore((state) => state.markAsSaved);
  const isEntryUnsaved = useHostsStore((state) => state.isEntryUnsaved);
  const viewMode = useHostsStore((state) => state.viewMode);
  const setViewMode = useHostsStore((state) => state.setViewMode);
  const { showToast } = useToast();

  const writeHosts = useCallback(async () => {
    const state = useHostsStore.getState();
    const entries = state.entries;

    // Validate entries before sending
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      showToast("No entries to save", "warning");
      return;
    }

    // Ensure all entries are valid objects
    const validEntries = entries.filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        entry.ip &&
        Array.isArray(entry.hostnames),
    );

    if (validEntries.length !== entries.length) {
      showToast(
        `${entries.length - validEntries.length} invalid entries will be skipped`,
        "warning",
        4000,
      );
    }

    try {
      showToast("Saving to /etc/hosts...", "info", 2000);
      const response = await globalThis.electronAPI.writeHosts(validEntries);
      if (response.success) {
        // Mark entries as saved
        markAsSaved();
        showToast("Successfully saved to /etc/hosts", "success");
      } else {
        showToast(`Failed to save: ${response.error}`, "error", 5000);
      }
    } catch (error) {
      showToast(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
        5000,
      );
    }
  }, [markAsSaved, showToast]);

  // Listen for menu save action
  React.useEffect(() => {
    const handleMenuSave = () => {
      writeHosts();
    };

    globalThis.addEventListener("menu:save", handleMenuSave);
    return () => {
      globalThis.removeEventListener("menu:save", handleMenuSave);
    };
  }, [writeHosts]);

  const enabledCount = entries.filter((e) => e.enabled).length;
  const disabledCount = entries.length - enabledCount;
  const unsavedCount = entries.filter((e) => isEntryUnsaved(e)).length;

  return (
    <header
      className="border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Title bar area for window controls */}
      <div
        className="h-8 w-full"
        style={
          {
            WebkitAppRegion: "drag",
            paddingTop: "8px",
            paddingLeft: "78px",
          } as React.CSSProperties
        }
      />

      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
            <h1 className="text-2xl font-bold">iHosts</h1>
            <p className="text-sm text-muted-foreground">
              Manage your hosts file with ease. /etc/hosts
            </p>
          </div>
          <div
            className="flex items-center gap-2"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-secondary transition-all hover:scale-105 active:scale-95"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span className="text-xl">{darkMode ? "☀️" : "🌙"}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div
            className="flex items-center gap-4 text-sm text-muted-foreground"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            <span>
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
            <span>•</span>
            <span className="text-green-600 dark:text-green-400">
              {enabledCount} enabled
            </span>
            <span>•</span>
            <span className="text-gray-500">{disabledCount} disabled</span>
            {unsavedCount > 0 && (
              <>
                <span>•</span>
                <span className="text-orange-600 dark:text-orange-400 font-medium">
                  {unsavedCount} unsaved
                </span>
              </>
            )}
          </div>

          <div
            className="flex items-center gap-2"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <button
              onClick={() => {
                if (viewMode === "backups") {
                  setViewMode("entries");
                } else {
                  setViewMode(
                    viewMode === "plainText" ? "entries" : "plainText",
                  );
                }
              }}
              className={`px-4 py-2 rounded-lg border border-border transition-all text-sm font-medium ${
                viewMode === "plainText"
                  ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                  : "hover:bg-accent hover:text-accent-foreground hover:shadow-sm"
              }`}
              title={
                viewMode === "plainText"
                  ? "View entries"
                  : "View hosts file as plain text"
              }
            >
              <span className="mr-2">
                {viewMode === "plainText" ? "📝" : "📄"}
              </span>
              {viewMode === "plainText" ? "View Entries" : "Plain Text"}
            </button>
            <button
              onClick={() =>
                setViewMode(viewMode === "backups" ? "entries" : "backups")
              }
              className={`px-4 py-2 rounded-lg border border-border transition-all text-sm font-medium ${
                viewMode === "backups"
                  ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                  : "hover:bg-accent hover:text-accent-foreground hover:shadow-sm"
              }`}
              title="Manage backups"
            >
              <span className="mr-2">
                {viewMode === "backups" ? "📋" : "💾"}
              </span>
              {viewMode === "backups" ? "Back to Entries" : "Backups"}
            </button>
            <button
              onClick={() => {
                addEntry({
                  ip: "127.0.0.1",
                  hostnames: ["localhost"],
                  enabled: true,
                });
                showToast("New entry added", "success");
              }}
              className="px-4 py-2 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition-all text-sm font-medium hover:shadow-sm"
            >
              <span className="mr-2">+</span>Add Entry
            </button>
            <button
              onClick={writeHosts}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all text-sm font-semibold shadow-sm hover:shadow-md active:scale-95"
            >
              💾 Save
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
