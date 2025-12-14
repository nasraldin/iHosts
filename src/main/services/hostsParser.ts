import type { HostEntry } from "../../types/ipc";

export class HostsParser {
  /**
   * Parse hosts file content into structured entries
   */
  static parse(content: string): HostEntry[] {
    const entries: HostEntry[] = [];
    const lines = content.split("\n");
    let entryId = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) {
        continue;
      }

      // Handle comments
      if (line.startsWith("#")) {
        // Check if this is a disabled entry (comment starting with IP address)
        const commentContent = line.substring(1).trim();
        const disabledEntry = this.parseEntryLine(commentContent, entryId++);
        if (disabledEntry) {
          // This is a disabled entry, not a regular comment
          disabledEntry.enabled = false;
          entries.push(disabledEntry);
          continue;
        }
        // Otherwise, treat as regular comment
        this.handleCommentLine(line, entries, i, lines);
        continue;
      }

      // Parse entry line
      const entry = this.parseEntryLine(line, entryId++);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Handle comment lines - attach to previous entry if applicable
   */
  private static handleCommentLine(
    line: string,
    entries: HostEntry[],
    lineIndex: number,
    allLines: string[],
  ): void {
    if (entries.length === 0 || lineIndex === 0) {
      return;
    }

    const prevLine = allLines[lineIndex - 1]?.trim();
    if (prevLine && !prevLine.startsWith("#")) {
      const comment = line.substring(1).trim();
      if (comment) {
        const lastEntry = entries.at(-1);
        if (lastEntry) {
          lastEntry.comment = comment;
        }
      }
    }
  }

  /**
   * Parse a single entry line into a HostEntry
   */
  private static parseEntryLine(
    line: string,
    entryId: number,
  ): HostEntry | null {
    const parts = line.split(/\s+/);
    if (parts.length < 2) {
      return null;
    }

    const ip = parts[0];
    const hostnames = parts.slice(1).filter((h) => h && !h.startsWith("#"));

    // Validate IP address
    if (!this.isValidIP(ip)) {
      return null;
    }

    // Extract inline comment if present
    const commentRegex = /#\s*(.+)$/;
    const commentMatch = commentRegex.exec(line);
    const comment = commentMatch ? commentMatch[1].trim() : undefined;

    return {
      id: `entry-${entryId}`,
      ip,
      hostnames,
      enabled: true,
      comment,
    };
  }

  /**
   * Convert entries back to hosts file format
   * This converts the entries array into plain text format for /etc/hosts file
   * Example output:
   *   127.0.0.1 localhost
   *   192.168.1.1 example.com
   */
  static stringify(entries: HostEntry[]): string {
    // Removed debug log for production
    if (process.env.NODE_ENV === "development") {
      console.log("Stringify called with:", {
        type: typeof entries,
        isArray: Array.isArray(entries),
        length: entries?.length,
      });
    }

    if (!entries) {
      throw new Error("Entries is null or undefined in stringify");
    }

    if (!Array.isArray(entries)) {
      throw new TypeError(
        `Entries must be an array in stringify, got: ${typeof entries}. Value: ${JSON.stringify(entries).substring(0, 200)}`,
      );
    }

    const lines: string[] = [];

    // Add header comment
    lines.push(
      "# Hosts file managed by iHosts",
      `# Generated at ${new Date().toISOString()}`,
      "",
    );

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") {
        if (process.env.NODE_ENV === "development") {
          console.warn("Skipping invalid entry:", entry);
        }
        continue;
      }
      lines.push(...this.formatEntry(entry));
    }

    return lines.join("\n") + "\n";
  }

  /**
   * Format a single entry into hosts file lines
   */
  private static formatEntry(entry: HostEntry): string[] {
    const lines: string[] = [];
    const hostnameLine = `${entry.ip} ${entry.hostnames.join(" ")}`;

    if (entry.enabled) {
      // Write enabled entries normally
      if (entry.comment) {
        lines.push(`${hostnameLine} # ${entry.comment}`);
      } else {
        lines.push(hostnameLine);
      }
    } else {
      // Write disabled entries as comments
      lines.push(`# ${hostnameLine}`);
      if (entry.comment) {
        lines.push(`# ${entry.comment}`);
      }
    }

    return lines;
  }

  /**
   * Validate IP address (IPv4 or IPv6)
   */
  static isValidIP(ip: string): boolean {
    // IPv4 validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(ip)) {
      const parts = ip.split(".").map(Number);
      return parts.every((part) => part >= 0 && part <= 255);
    }

    // IPv6 validation (simplified)
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    if (ipv6Regex.test(ip)) {
      return true;
    }

    // Check for compressed IPv6 (::)
    if (ip.includes("::")) {
      const parts = ip.split("::");
      if (parts.length === 2) {
        const left = parts[0].split(":").filter(Boolean);
        const right = parts[1].split(":").filter(Boolean);
        return left.length + right.length <= 8;
      }
    }

    return false;
  }

  /**
   * Validate hostname
   */
  static isValidHostname(hostname: string): boolean {
    if (hostname.length > 253) return false;
    const hostnameRegex =
      /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    return hostnameRegex.test(hostname);
  }

  /**
   * Validate entry before saving
   */
  static validateEntry(entry: HostEntry): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.isValidIP(entry.ip)) {
      errors.push(`Invalid IP address: ${entry.ip}`);
    }

    if (entry.hostnames.length === 0) {
      errors.push("At least one hostname is required");
    }

    for (const hostname of entry.hostnames) {
      if (!this.isValidHostname(hostname)) {
        errors.push(`Invalid hostname: ${hostname}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
