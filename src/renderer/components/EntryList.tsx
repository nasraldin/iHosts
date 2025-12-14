import React from "react";
import { useHostsStore } from "../store/useHostsStore";
import { EntryItem } from "./EntryItem";

export const EntryList: React.FC = () => {
  const filteredEntries = useHostsStore((state) => state.filteredEntries);
  const entries = useHostsStore((state) => state.entries);
  const isLoading = useHostsStore((state) => state.isLoading);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 animate-in fade-in-0">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-muted-foreground font-medium">
          Loading hosts file...
        </div>
      </div>
    );
  }

  if (filteredEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4 animate-in fade-in-0 zoom-in-95">
        <div className="text-6xl mb-6 animate-bounce">📝</div>
        <div className="text-xl font-semibold mb-2">No entries found</div>
        <div className="text-sm text-muted-foreground max-w-md">
          {entries.length === 0
            ? "Add your first host entry to get started"
            : "Try adjusting your search or filter to see more entries"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredEntries.map((entry) => (
        <EntryItem key={entry.id} entry={entry} />
      ))}
    </div>
  );
};
