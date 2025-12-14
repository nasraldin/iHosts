import React, { useState } from "react";
import { useHostsStore } from "../store/useHostsStore";
import type { HostEntry } from "../../types/ipc";

export const PlainTextContent: React.FC = () => {
  const entries = useHostsStore((state) => state.entries);
  const [copied, setCopied] = useState(false);

  // Convert entries to plain text hosts file format
  const convertToPlainText = (entries: HostEntry[]): string => {
    const lines: string[] = [];

    // Add header comment
    lines.push(
      "# Hosts file managed by iHosts",
      `# Generated at ${new Date().toISOString()}`,
      ""
    );

    for (const entry of entries) {
      if (entry.enabled) {
        // Write enabled entries
        const line = `${entry.ip} ${entry.hostnames.join(" ")}`;
        if (entry.comment) {
          lines.push(`${line} # ${entry.comment}`);
        } else {
          lines.push(line);
        }
      } else {
        // Write disabled entries as comments
        lines.push(`# ${entry.ip} ${entry.hostnames.join(" ")}`);
        if (entry.comment) {
          lines.push(`# ${entry.comment}`);
        }
      }
    }

    return lines.join("\n") + "\n";
  };

  const plainText = convertToPlainText(entries);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-semibold mb-1">
            Hosts File (Plain Text)
          </h2>
          <p className="text-sm text-muted-foreground">
            This is how the hosts file will look when saved. Disabled entries
            are shown as comments.
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="px-4 py-2 rounded border border-border hover:bg-secondary transition-colors text-sm"
        >
          {copied ? "✓ Copied!" : "📋 Copy"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <pre className="font-mono text-sm text-foreground whitespace-pre-wrap wrap-break-word bg-muted/30 p-4 rounded border border-border">
          {plainText}
        </pre>
      </div>
    </div>
  );
};
