import { createId } from "@paralleldrive/cuid2";
import type { NanoboardDB } from "./db";
import type { Whiteboard } from "./schema";

/**
 * Like the backup module, these functions take the database instance as a
 * parameter instead of reaching for the singleton — that is what keeps them
 * isolated and testable on fake-indexeddb (see test-db.ts). Production
 * callers pass the singleton.
 */

/**
 * Per-session row identity (primary key + creation stamp), so steady-state
 * saves are a single `put()` instead of a read-modify-write — a scene row can
 * reach multi-MB with embedded images, and each read or write structured-
 * clones it whole. Seeded by `getWhiteboard`; evicted when the project is
 * deleted. Bounded by the projects visited this session, so it never needs
 * eviction of its own.
 */
interface RowIdentity {
  id: string;
  createdAt: number;
}

const rowIdentityByDb = new WeakMap<NanoboardDB, Map<string, RowIdentity>>();

function identityCacheFor(database: NanoboardDB): Map<string, RowIdentity> {
  let cache = rowIdentityByDb.get(database);
  if (!cache) {
    cache = new Map();
    rowIdentityByDb.set(database, cache);
  }
  return cache;
}

export async function getWhiteboard(
  db: NanoboardDB,
  projectId: string,
): Promise<Whiteboard | undefined> {
  // The `&[projectId]` unique index guarantees at most one row per project.
  const row = await db.whiteboards.where("projectId").equals(projectId).first();
  if (row) {
    identityCacheFor(db).set(projectId, {
      id: row.id,
      createdAt: row.createdAt,
    });
  }
  return row;
}

/** Forgets a project's cached row identity in this database; call when its rows are deleted. */
export function forgetWhiteboard(db: NanoboardDB, projectId: string): void {
  rowIdentityByDb.get(db)?.delete(projectId);
}

/** Drops every cached whiteboard identity for this database (used on restore & reset). */
export function clearWhiteboardCache(db: NanoboardDB): void {
  rowIdentityByDb.delete(db);
}

/**
 * Persists the scene triple as one row. Sanitizing appState, stripping deleted
 * elements, and pruning files happens before this is called (in the lazy
 * editor chunk, which is the only runtime importer of Excalidraw); this
 * function stays a pure Dexie upsert. The row is created lazily on the first
 * save, so projects whose whiteboard was never drawn on store nothing.
 */
export async function saveWhiteboardScene(
  db: NanoboardDB,
  projectId: string,
  scene: Pick<Whiteboard, "elements" | "appState" | "files">,
): Promise<void> {
  const now = Date.now();
  const cache = identityCacheFor(db);

  // Hot path: identity known from a previous read or create — one clone.
  const identity = cache.get(projectId);
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
      cache.set(projectId, {
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
    cache.set(projectId, { id: row.id, createdAt: row.createdAt });
    await db.whiteboards.add(row);
  });
}
