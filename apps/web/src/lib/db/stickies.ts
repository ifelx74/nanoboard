import { createId } from "@paralleldrive/cuid2";
import { db } from "./db";
import type { Sticky, StickyColorKey } from "./schema";
import { STICKY_COLORS } from "./schema";

export function getRandomStickyColor(): StickyColorKey {
  const randomIndex = Math.floor(Math.random() * STICKY_COLORS.length);
  return STICKY_COLORS[randomIndex];
}

/** Plain-text projection of a note's HTML, for emptiness checks and search. */
function stickyTextContent(contentHtml?: string): string {
  return (contentHtml ?? "").replace(/<[^>]*>/g, " ");
}

/**
 * Lowercase plain text per sticky id. Memoize on the `stickies` array so a
 * search keystroke never re-extracts HTML — only data changes rebuild it.
 */
export function stickySearchIndex(stickies: Sticky[]): Map<string, string> {
  return new Map(
    stickies.map((sticky) => [
      sticky.id,
      stickyTextContent(sticky.contentHtml).toLowerCase(),
    ]),
  );
}

export function isStickyEmpty(content?: string): boolean {
  return stickyTextContent(content).trim() === "";
}

export async function getStickies(): Promise<Sticky[]> {
  return db.stickies.orderBy("position").toArray();
}

/** Thrown by `createSticky` while the newest note is still empty (Plane behavior). */
export class EmptyStickyExistsError extends Error {
  constructor() {
    super("An empty sticky already exists");
    this.name = "EmptyStickyExistsError";
  }
}

export async function createSticky(): Promise<Sticky> {
  const stickies = await db.stickies.orderBy("position").toArray();
  const newestSticky = stickies[0];

  if (newestSticky && isStickyEmpty(newestSticky.contentHtml)) {
    throw new EmptyStickyExistsError();
  }

  const minPosition = newestSticky ? newestSticky.position : 0;
  const now = Date.now();

  const newSticky: Sticky = {
    id: createId(),
    contentHtml: "<p></p>",
    backgroundColor: getRandomStickyColor(),
    position: minPosition - 1000,
    createdAt: now,
    updatedAt: now,
  };

  await db.stickies.add(newSticky);
  return newSticky;
}

export async function updateSticky(
  id: string,
  updates: Partial<Omit<Sticky, "id" | "createdAt">>,
): Promise<void> {
  await db.stickies.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function deleteSticky(id: string): Promise<void> {
  await db.stickies.delete(id);
}

export async function reorderStickies(
  activeId: string,
  overId: string,
): Promise<void> {
  if (activeId === overId) return;

  await db.transaction("rw", db.stickies, async () => {
    const stickies = await db.stickies.orderBy("position").toArray();
    const activeIndex = stickies.findIndex((s) => s.id === activeId);
    const overIndex = stickies.findIndex((s) => s.id === overId);

    if (activeIndex === -1 || overIndex === -1) return;

    // Remove the dragged note first, then look the target up again: its index
    // shifts by one when the dragged note came from before it. Inserting at
    // the shifted index drops the note *in front of* the target, which is what
    // the drag preview showed.
    const [moved] = stickies.splice(activeIndex, 1);
    const targetIndex = stickies.findIndex((s) => s.id === overId);
    if (targetIndex === -1) return;
    stickies.splice(targetIndex, 0, moved);

    // Re-seat only the dragged note between its new neighbours instead of
    // rewriting every row. Once repeated halving leaves no gap between the
    // neighbours, fall back to a uniform re-index.
    const before = stickies[targetIndex - 1];
    const after = stickies[targetIndex + 1];
    if (before && after && after.position - before.position >= 1) {
      await db.stickies.update(activeId, {
        position: (before.position + after.position) / 2,
      });
      return;
    }
    if (!before && after) {
      await db.stickies.update(activeId, {
        position: after.position - 1000,
      });
      return;
    }
    if (before && !after) {
      await db.stickies.update(activeId, {
        position: before.position + 1000,
      });
      return;
    }
    if (!before && !after) return;

    await Promise.all(
      stickies.map((sticky, index) =>
        db.stickies.update(sticky.id, { position: index * 1000 }),
      ),
    );
  });
}
