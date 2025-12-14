import React, { useState } from "react";
import { useHostsStore } from "../store/useHostsStore";
import { useToast } from "./Toast";
import type { HostEntry } from "../../types/ipc";

interface EntryItemProps {
  entry: HostEntry;
}

export const EntryItem: React.FC<EntryItemProps> = ({ entry }) => {
  const [isEditing, setIsEditing] = useState(false);
  const updateEntry = useHostsStore((state) => state.updateEntry);
  const deleteEntry = useHostsStore((state) => state.deleteEntry);
  const toggleEntry = useHostsStore((state) => state.toggleEntry);
  const isEntryUnsaved = useHostsStore((state) => state.isEntryUnsaved);
  const { showToast } = useToast();

  const isUnsaved = isEntryUnsaved(entry);

  const handleToggle = () => {
    toggleEntry(entry.id);
    showToast(entry.enabled ? "Entry disabled" : "Entry enabled", "info", 2000);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this entry?")) {
      deleteEntry(entry.id);
      showToast("Entry deleted", "success");
    }
  };

  return (
    <div
      className={`group relative p-4 rounded-xl border transition-all duration-200 ${
        entry.enabled
          ? "bg-background border-border hover:border-primary/50 hover:shadow-md"
          : "bg-muted/30 border-border/50 opacity-60"
      } ${isUnsaved ? "ring-2 ring-orange-500/50 shadow-orange-500/10" : ""} animate-in fade-in-0 slide-in-from-bottom-2`}
    >
      {isUnsaved && (
        <div className="absolute top-3 right-3 animate-in fade-in-0 zoom-in-95">
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 shadow-sm">
            ⚠ Unsaved
          </span>
        </div>
      )}
      <div className="flex items-start gap-4">
        {/* Toggle Switch */}
        <button
          onClick={handleToggle}
          className={`mt-1 w-12 h-6 rounded-full transition-all duration-200 shadow-inner ${
            entry.enabled
              ? "bg-primary hover:bg-primary/90"
              : "bg-muted hover:bg-muted/80"
          }`}
          title={entry.enabled ? "Disable entry" : "Enable entry"}
        >
          <span
            className={`block w-5 h-5 rounded-full bg-white transform transition-transform duration-200 shadow-md ${
              entry.enabled ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>

        {/* Entry Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-sm font-medium text-foreground">
              {entry.ip}
            </span>
            <span className="text-muted-foreground">→</span>
            <div className="flex flex-wrap gap-2">
              {entry.hostnames.map((hostname) => (
                <span
                  key={hostname}
                  className="font-mono text-sm text-primary font-medium"
                >
                  {hostname}
                </span>
              ))}
            </div>
          </div>

          {(entry.comment || entry.group) && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              {entry.group && (
                <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                  {entry.group}
                </span>
              )}
              {entry.comment && <span>{entry.comment}</span>}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all hover:scale-110 active:scale-95"
            title="Edit entry (E)"
          >
            <span className="text-lg">✏️</span>
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all hover:scale-110 active:scale-95"
            title="Delete entry (Delete)"
          >
            <span className="text-lg">🗑️</span>
          </button>
        </div>
      </div>

      {isEditing && (
        <EntryEditor
          entry={entry}
          onSave={(updates) => {
            updateEntry(entry.id, updates);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      )}
    </div>
  );
};

interface EntryEditorProps {
  entry: HostEntry;
  onSave: (updates: Partial<HostEntry>) => void;
  onCancel: () => void;
}

const EntryEditor: React.FC<EntryEditorProps> = ({
  entry,
  onSave,
  onCancel,
}) => {
  const [ip, setIp] = useState(entry.ip);
  const [hostnames, setHostnames] = useState(entry.hostnames.join(" "));
  const [comment, setComment] = useState(entry.comment || "");
  const [group, setGroup] = useState(entry.group || "");
  const { showToast } = useToast();

  const handleSave = () => {
    const hostnameList = hostnames
      .split(/\s+/)
      .map((h) => h.trim())
      .filter(Boolean);

    if (!ip || hostnameList.length === 0) {
      showToast("IP and at least one hostname are required", "error");
      return;
    }

    onSave({
      ip,
      hostnames: hostnameList,
      comment: comment || undefined,
      group: group || undefined,
    });
    showToast("Entry updated", "success");
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        handleSave();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [ip, hostnames, comment, group]);

  return (
    <div className="mt-4 p-4 bg-secondary/50 rounded-xl border border-border space-y-3 animate-in fade-in-0 slide-in-from-top-2">
      <div>
        <label
          htmlFor="entry-ip-input"
          className="block text-xs font-semibold mb-1.5 text-foreground"
        >
          IP Address
        </label>
        <input
          id="entry-ip-input"
          type="text"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          placeholder="127.0.0.1"
          autoFocus
        />
      </div>
      <div>
        <label
          htmlFor="entry-hostnames-input"
          className="block text-xs font-semibold mb-1.5 text-foreground"
        >
          Hostnames
        </label>
        <input
          id="entry-hostnames-input"
          type="text"
          value={hostnames}
          onChange={(e) => setHostnames(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          placeholder="localhost example.com"
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Separate multiple hostnames with spaces
        </p>
      </div>
      <div>
        <label
          htmlFor="entry-group-input"
          className="block text-xs font-semibold mb-1.5 text-foreground"
        >
          Group (optional)
        </label>
        <input
          id="entry-group-input"
          type="text"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          placeholder="Development"
        />
      </div>
      <div>
        <label
          htmlFor="entry-comment-input"
          className="block text-xs font-semibold mb-1.5 text-foreground"
        >
          Comment (optional)
        </label>
        <input
          id="entry-comment-input"
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          placeholder="Local development server"
        />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-border hover:bg-secondary transition-all text-sm font-medium hover:shadow-sm active:scale-95"
        >
          Cancel (Esc)
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all text-sm font-semibold shadow-sm hover:shadow-md active:scale-95"
        >
          Save (⌘+Enter)
        </button>
      </div>
    </div>
  );
};
