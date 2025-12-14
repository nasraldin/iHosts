import React from "react";
import { useHostsStore } from "../store/useHostsStore";

export const FilterBar: React.FC = () => {
  const filterStatus = useHostsStore((state) => state.filterStatus);
  const setFilterStatus = useHostsStore((state) => state.setFilterStatus);
  const entries = useHostsStore((state) => state.entries);
  const isEntryUnsaved = useHostsStore((state) => state.isEntryUnsaved);
  const sortBy = useHostsStore((state) => state.sortBy);
  const setSortBy = useHostsStore((state) => state.setSortBy);
  const sortOrder = useHostsStore((state) => state.sortOrder);
  const setSortOrder = useHostsStore((state) => state.setSortOrder);

  const unsavedCount = entries.filter((e) => isEntryUnsaved(e)).length;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          Status:
        </span>
        <div className="flex gap-1 rounded-lg border border-border p-1 bg-background/50">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              filterStatus === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus("enabled")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              filterStatus === "enabled"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            Enabled
          </button>
          <button
            onClick={() => setFilterStatus("disabled")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              filterStatus === "disabled"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            Disabled
          </button>
          <button
            onClick={() => setFilterStatus("unsaved")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all relative ${
              filterStatus === "unsaved"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
            title={`${unsavedCount} unsaved ${unsavedCount === 1 ? "entry" : "entries"}`}
          >
            Unsaved
            {unsavedCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-accent text-accent-foreground font-semibold animate-in zoom-in-95">
                {unsavedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Sort:</span>
        <div className="flex gap-1 rounded-lg border border-border p-1 bg-background/50">
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "ip" | "hostname" | "group" | "none")
            }
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-transparent text-foreground border-0 outline-none cursor-pointer hover:bg-secondary/50 transition-all focus:ring-2 focus:ring-primary"
          >
            <option value="none">None</option>
            <option value="ip">IP Address</option>
            <option value="hostname">Hostname</option>
            <option value="group">Group</option>
          </select>
          {sortBy !== "none" && (
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-all"
              title={`Sort ${sortOrder === "asc" ? "Descending" : "Ascending"}`}
            >
              <span className="text-base">
                {sortOrder === "asc" ? "↑" : "↓"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
