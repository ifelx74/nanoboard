import { createId } from "@paralleldrive/cuid2";
import { db } from "./db";
import type { Whiteboard } from "./schema";

/**
 * Per-session row identity (primary key + creation stamp), so steady-state
 * saves are a single `put()` instead of a read-modify-write — a scene row can
 * reach multi-MB with embedded images, and each read or write structured-
 * clones it whole. Seeded by `getWhiteboard`; evicted when the project is
 * deleted. Bounded by the projects visited this session, so it never needs
 * eviction of its own.
 */
const rowIdentity = new Map<string, { id: string; createdAt: number }>();

export async function getWhiteboard(
  projectId: string,
): Promise<Whiteboard | undefined> {
  // The `&[projectId]` unique index guarantees at most one row per project.
  const row = await db.whiteboards.where("projectId").equals(projectId).first();
  if (row) {
    rowIdentity.set(projectId, { id: row.id, createdAt: row.createdAt });
  }
  return row;
}

/** Forgets a project's cached row identity; call when its rows are deleted. */
export function forgetWhiteboard(projectId: string): void {
  rowIdentity.delete(projectId);
}

/**
 * Persists the scene triple as one row. Sanitizing appState, stripping deleted
 * elements, and pruning files happens before this is called (in the lazy
 * editor chunk, which is the only runtime importer of Excalidraw); this
 * function stays a pure Dexie upsert. The row is created lazily on the first
 * save, so projects whose whiteboard was never drawn on store nothing.
 */
export async function saveWhiteboardScene(
  projectId: string,
  scene: Pick<Whiteboard, "elements" | "appState" | "files">,
): Promise<void> {
  const now = Date.now();

  // Hot path: identity known from a previous read or create — one clone.
  const identity = rowIdentity.get(projectId);
  if (identity) {
    await db.whiteboards.put({
      id: identity.id,
      projectId,
      ...scene,
      createdAt: identity.createdAt,
      updatedAt: now,
    });
    return;
  }

  // Cold path (first save this session): resolve the row transactionally so
  // two racing first-saves can't both create (the unique index would reject
  // the second anyway; the transaction keeps it clean).
  await db.transaction("rw", db.whiteboards, async () => {
    const existing = await db.whiteboards
      .where("projectId")
      .equals(projectId)
      .first();
    if (existing) {
      rowIdentity.set(projectId, {
        id: existing.id,
        createdAt: existing.createdAt,
      });
      await db.whiteboards.put({ ...existing, ...scene, updatedAt: now });
      return;
    }
    const row: Whiteboard = {
      id: createId(),
      projectId,
      ...scene,
      createdAt: now,
      updatedAt: now,
    };
    rowIdentity.set(projectId, { id: row.id, createdAt: row.createdAt });
    await db.whiteboards.add(row);
  });
}
