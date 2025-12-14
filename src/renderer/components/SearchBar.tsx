import React from "react";
import { useHostsStore } from "../store/useHostsStore";

export const SearchBar: React.FC = () => {
  const searchQuery = useHostsStore((state) => state.searchQuery);
  const setSearchQuery = useHostsStore((state) => state.setSearchQuery);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector(
          'input[type="text"]',
        ) as HTMLInputElement;
        input?.focus();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search by IP, hostname, comment, or group... (⌘K)"
        className="w-full px-4 py-2.5 pl-10 pr-10 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm focus:shadow-md"
      />
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
        🔍
      </span>
      {searchQuery && (
        <button
          onClick={() => setSearchQuery("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary"
          title="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
};
