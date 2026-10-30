import type { NanoboardDB } from "./db";
import type { WhiteboardPreview } from "./schema";

/**
 * The whiteboard preview store: a lightweight per-project "has content" index
 * for the whiteboard gallery, deliberately separate from the multi-MB scene
 * rows. Exactly one row per project exists while its saved scene holds at
 * least one non-deleted element — content-ful save flushes upsert it
 * (refreshing the freshness stamp), emptied-canvas flushes and project
 * deletion remove it, so the table never accumulates orphans. The stored
 * thumbnail may be empty until a rendered one is written.
 *
 * Like the backup module, these functions take the database instance as a
 * parameter instead of reaching for the singleton — that is what keeps them
 * isolated and testable on fake-indexeddb (see test-db.ts).
 */

/** Reads a project's preview row, if it has one. */
export async function getWhiteboardPreview(
  db: NanoboardDB,
  projectId: string,
): Promise<WhiteboardPreview | undefined> {
  return db.whiteboardPreviews.get(projectId);
}

/**
 * Upserts the project's preview row: the primary key on projectId makes a
 * repeated save update the existing row in place — advancing the freshness
 * stamp — instead of piling up rows. `dataUrl` may be empty until a rendered
 * thumbnail is stored for the row.
 */
export async function saveWhiteboardPreview(
  db: NanoboardDB,
  projectId: string,
  dataUrl: string,
): Promise<void> {
  await db.whiteboardPreviews.put({
    projectId,
    dataUrl,
    updatedAt: Date.now(),
  });
}

/**
 * Removes the project's preview row. A no-op when the row is absent, which
 * is the ordinary case for projects whose whiteboard was never drawn on.
 */
export async function deleteWhiteboardPreview(
  db: NanoboardDB,
  projectId: string,
): Promise<void> {
  await db.whiteboardPreviews.delete(projectId);
}
