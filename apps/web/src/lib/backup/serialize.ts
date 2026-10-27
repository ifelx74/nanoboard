import type { BackupDocument } from "./types";

/**
 * Serialize a backup document minified: one line, no formatting whitespace,
 * so large whiteboard scenes (data-URL image files) don't bloat the file.
 */
export function serializeBackupDocument(document: BackupDocument): string {
  return JSON.stringify(document);
}
