import { createId } from "@paralleldrive/cuid2";
import { db } from "./db";
import type { Whiteboard } from "./schema";

export async function getWhiteboard(
  projectId: string,
): Promise<Whiteboard | undefined> {
  // The `&[projectId]` unique index guarantees at most one row per project.
  return db.whiteboards.where("projectId").equals(projectId).first();
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
  await db.transaction("rw", db.whiteboards, async () => {
    const existing = await db.whiteboards
      .where("projectId")
      .equals(projectId)
      .first();
    const now = Date.now();
    if (existing) {
      await db.whiteboards.update(existing.id, {
        elements: scene.elements,
        appState: scene.appState,
        files: scene.files,
        updatedAt: now,
      });
      return;
    }
    const row: Whiteboard = {
      id: createId(),
      projectId,
      elements: scene.elements,
      appState: scene.appState,
      files: scene.files,
      createdAt: now,
      updatedAt: now,
    };
    await db.whiteboards.add(row);
  });
}
