import React, { useEffect } from "react";
import { useHostsStore } from "./store/useHostsStore";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { FilterBar } from "./components/FilterBar";
import { EntryList } from "./components/EntryList";
import { PlainTextContent } from "./components/PlainTextContent";
import { BackupManager } from "./components/BackupManager";
import { ToastProvider } from "./components/Toast";

export const App: React.FC = () => {
  const setEntries = useHostsStore((state) => state.setEntries);
  const setLoading = useHostsStore((state) => state.setLoading);
  const setError = useHostsStore((state) => state.setError);
  const darkMode = useHostsStore((state) => state.darkMode);
  const entries = useHostsStore((state) => state.entries);
  const isEntryUnsaved = useHostsStore((state) => state.isEntryUnsaved);
  const addEntry = useHostsStore((state) => state.addEntry);

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Trigger will-prevent-unload in main process when there are unsaved changes
  // This allows the main process to show a native dialog
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const unsavedCount = entries.filter((e) => isEntryUnsaved(e)).length;
      if (unsavedCount > 0) {
        // Prevent default to trigger will-prevent-unload in main process
        // The main process will show the native dialog
        e.preventDefault();
        // Modern browsers ignore returnValue and show their own message
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [entries, isEntryUnsaved]);

  // Load hosts file on mount
  useEffect(() => {
    const loadHosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await globalThis.electronAPI.readHosts();
        if (response.success && response.data) {
          const entries = response.data.entries;
          if (Array.isArray(entries)) {
            setEntries(entries);
          } else {
            console.error("Invalid entries format:", entries);
            setError("Invalid entries format received from hosts file");
          }
        } else {
          setError(response.error || "Failed to load hosts file");
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    loadHosts();

    // Watch for external changes
    const cleanup = globalThis.electronAPI.watchHosts((data) => {
      if (data && Array.isArray(data.entries)) {
        setEntries(data.entries);
      } else {
        console.error("Invalid watch data:", data);
      }
    });

    return cleanup;
  }, [setEntries, setLoading, setError]);

  // Handle menu actions from main process
  useEffect(() => {
    const handleMenuNewEntry = () => {
      addEntry({
        ip: "127.0.0.1",
        hostnames: [""],
        enabled: true,
      });
    };

    const handleMenuSave = () => {
      // Dispatch custom event that Header component can listen to
      globalThis.dispatchEvent(new CustomEvent("menu:save"));
    };

    // Listen for menu messages from main process
    const removeNewEntryListener =
      globalThis.electronAPI.onMenuNewEntry(handleMenuNewEntry);
    const removeSaveListener =
      globalThis.electronAPI.onMenuSave(handleMenuSave);

    return () => {
      removeNewEntryListener();
      removeSaveListener();
    };
  }, [addEntry]);

  const error = useHostsStore((state) => state.error);
  const viewMode = useHostsStore((state) => state.viewMode);

  return (
    <ToastProvider>
      <div className="h-screen flex flex-col bg-background text-foreground">
        <Header />

        <main className="flex-1 overflow-hidden flex flex-col">
          {viewMode === "entries" && (
            <div className="px-6 py-4 space-y-4 border-b border-border bg-background/50 backdrop-blur-sm">
              <SearchBar />
              <FilterBar />
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {error && (
              <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive text-destructive animate-in fade-in-0 slide-in-from-top-2 duration-300">
                <strong>Error:</strong> {error}
              </div>
            )}
            {viewMode === "entries" && <EntryList />}
            {viewMode === "plainText" && <PlainTextContent />}
            {viewMode === "backups" && <BackupManager />}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
};
