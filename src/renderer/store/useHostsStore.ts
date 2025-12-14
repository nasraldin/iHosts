import { create } from "zustand";
import type { HostEntry, BackupInfo } from "../../types/ipc";

interface HostsStore {
  // State
  entries: HostEntry[];
  originalEntries: HostEntry[]; // Entries from the last saved state
  filteredEntries: HostEntry[];
  backups: BackupInfo[];
  searchQuery: string;
  filterStatus: "all" | "enabled" | "disabled" | "unsaved"; // Filter by status
  sortBy: "ip" | "hostname" | "group" | "none";
  sortOrder: "asc" | "desc";
  isLoading: boolean;
  error: string | null;
  darkMode: boolean;
  viewMode: "entries" | "plainText" | "backups"; // View mode: entries list, plain text, or backups

  // Actions
  setEntries: (entries: HostEntry[]) => void;
  markAsSaved: () => void; // Mark current entries as saved
  discardChanges: () => void; // Discard unsaved changes by resetting to originalEntries
  addEntry: (entry: Omit<HostEntry, "id">) => void;
  updateEntry: (id: string, updates: Partial<HostEntry>) => void;
  deleteEntry: (id: string) => void;
  toggleEntry: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setFilterStatus: (status: "all" | "enabled" | "disabled" | "unsaved") => void;
  setSortBy: (sortBy: "ip" | "hostname" | "group" | "none") => void;
  setSortOrder: (order: "asc" | "desc") => void;
  setBackups: (backups: BackupInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleDarkMode: () => void;
  setViewMode: (mode: "entries" | "plainText" | "backups") => void;
  applyFilters: () => void;
  isEntryUnsaved: (entry: HostEntry) => boolean;
}

// Load dark mode preference from localStorage
const loadDarkModePreference = (): boolean => {
  if (globalThis.window === undefined) {
    return false;
  }

  const saved = globalThis.localStorage?.getItem("iHosts:darkMode");
  if (saved !== null) {
    return saved === "true";
  }

  // Default to system preference if no saved preference
  return (
    globalThis.window?.matchMedia("(prefers-color-scheme: dark)").matches ??
    false
  );
};

// Save dark mode preference to localStorage
const saveDarkModePreference = (darkMode: boolean): void => {
  if (globalThis.window !== undefined && globalThis.localStorage) {
    globalThis.localStorage.setItem("iHosts:darkMode", darkMode.toString());
  }
};

export const useHostsStore = create<HostsStore>((set, get) => {
  // Expose store to window for unsaved changes check
  if (globalThis.window !== undefined) {
    (globalThis.window as unknown as Record<string, unknown>).__hostsStore = {
      getState: get,
    };
  }

  // Initialize dark mode from saved preference
  const initialDarkMode = loadDarkModePreference();
  if (globalThis.document) {
    globalThis.document.documentElement.classList.toggle(
      "dark",
      initialDarkMode,
    );
  }

  return {
    // Initial state
    entries: [],
    originalEntries: [], // Track saved state
    filteredEntries: [],
    backups: [],
    searchQuery: "",
    filterStatus: "all",
    sortBy: "none",
    sortOrder: "asc",
    isLoading: false,
    error: null,
    darkMode: initialDarkMode,
    viewMode: "entries",

    // Actions
    setEntries: (entries) => {
      // Ensure entries is always an array
      const entriesArray = Array.isArray(entries) ? entries : [];
      set({ entries: entriesArray, originalEntries: [...entriesArray] }); // Mark as saved when loading from file
      get().applyFilters();
    },

    markAsSaved: () => {
      const currentEntries = get().entries;
      const entriesArray = Array.isArray(currentEntries) ? currentEntries : [];
      set({ originalEntries: [...entriesArray] });
      get().applyFilters();
    },

    discardChanges: () => {
      // Reset entries to originalEntries (discard unsaved changes)
      const originalEntries = get().originalEntries;
      const entriesArray = Array.isArray(originalEntries)
        ? originalEntries
        : [];
      set({ entries: [...entriesArray] });
      get().applyFilters();
    },

    addEntry: (entryData) => {
      const newEntry: HostEntry = {
        ...entryData,
        id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      };
      const currentEntries = get().entries;
      const entriesArray = Array.isArray(currentEntries) ? currentEntries : [];
      const entries = [...entriesArray, newEntry];
      set({ entries });
      get().applyFilters();
    },

    updateEntry: (id, updates) => {
      const currentEntries = get().entries;
      const entriesArray = Array.isArray(currentEntries) ? currentEntries : [];
      const entries = entriesArray.map((entry) =>
        entry.id === id ? { ...entry, ...updates } : entry,
      );
      set({ entries });
      get().applyFilters();
    },

    deleteEntry: (id) => {
      const currentEntries = get().entries;
      const entriesArray = Array.isArray(currentEntries) ? currentEntries : [];
      const entries = entriesArray.filter((entry) => entry.id !== id);
      set({ entries });
      get().applyFilters();
    },

    toggleEntry: (id) => {
      const currentEntries = get().entries;
      const entriesArray = Array.isArray(currentEntries) ? currentEntries : [];
      const entries = entriesArray.map((entry) =>
        entry.id === id ? { ...entry, enabled: !entry.enabled } : entry,
      );
      set({ entries });
      get().applyFilters();
    },

    setSearchQuery: (query) => {
      set({ searchQuery: query });
      get().applyFilters();
    },

    setFilterStatus: (status) => {
      set({ filterStatus: status });
      get().applyFilters();
    },

    setSortBy: (sortBy) => {
      set({ sortBy });
      get().applyFilters();
    },

    setSortOrder: (order) => {
      set({ sortOrder: order });
      get().applyFilters();
    },

    setBackups: (backups) => set({ backups }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    toggleDarkMode: () => {
      const darkMode = !get().darkMode;
      set({ darkMode });
      saveDarkModePreference(darkMode);
      if (globalThis.document) {
        globalThis.document.documentElement.classList.toggle("dark", darkMode);
      }
    },

    setViewMode: (mode) => set({ viewMode: mode }),

    isEntryUnsaved: (entry) => {
      const { originalEntries } = get();
      // Check if entry is new (not in original)
      const originalEntry = originalEntries.find((e) => e.id === entry.id);
      if (!originalEntry) {
        return true; // New entry
      }
      // Check if entry was modified
      const sortedHostnames = [...entry.hostnames].sort((a, b) =>
        a.localeCompare(b),
      );
      const sortedOriginalHostnames = [...originalEntry.hostnames].sort(
        (a, b) => a.localeCompare(b),
      );
      return (
        entry.ip !== originalEntry.ip ||
        JSON.stringify(sortedHostnames) !==
          JSON.stringify(sortedOriginalHostnames) ||
        entry.enabled !== originalEntry.enabled ||
        entry.comment !== originalEntry.comment ||
        entry.group !== originalEntry.group
      );
    },

    applyFilters: () => {
      const state = get();
      const entries = Array.isArray(state.entries) ? state.entries : [];
      const { searchQuery, filterStatus, sortBy, sortOrder } = state;

      let filtered = [...entries];

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (entry) =>
            entry.ip.toLowerCase().includes(query) ||
            entry.hostnames.some((h) => h.toLowerCase().includes(query)) ||
            entry.comment?.toLowerCase().includes(query) ||
            entry.group?.toLowerCase().includes(query),
        );
      }

      // Apply status filter
      if (filterStatus === "enabled") {
        filtered = filtered.filter((entry) => entry.enabled);
      } else if (filterStatus === "disabled") {
        filtered = filtered.filter((entry) => !entry.enabled);
      } else if (filterStatus === "unsaved") {
        filtered = filtered.filter((entry) => get().isEntryUnsaved(entry));
      }

      // Apply sorting
      if (sortBy !== "none") {
        filtered.sort((a, b) => {
          let comparison = 0;

          switch (sortBy) {
            case "ip": {
              comparison = a.ip.localeCompare(b.ip);
              break;
            }
            case "hostname": {
              const aHost = a.hostnames[0] || "";
              const bHost = b.hostnames[0] || "";
              comparison = aHost.localeCompare(bHost);
              break;
            }
            case "group": {
              const aGroup = a.group || "";
              const bGroup = b.group || "";
              comparison = aGroup.localeCompare(bGroup);
              break;
            }
          }

          return sortOrder === "asc" ? comparison : -comparison;
        });
      }

      set({ filteredEntries: filtered });
    },
  };
});
