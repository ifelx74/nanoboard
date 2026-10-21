import { createId } from "@paralleldrive/cuid2";
import { db } from "./db";
import type { Sticky, StickyColorKey } from "./schema";
import { STICKY_COLORS } from "./schema";

export function getRandomStickyColor(): StickyColorKey {
  const randomIndex = Math.floor(Math.random() * STICKY_COLORS.length);
  return STICKY_COLORS[randomIndex];
}

export function isStickyEmpty(content?: string): boolean {
  if (!content) return true;
  const stripped = content.replace(/<[^>]*>/g, "").trim();
  return stripped === "";
}

export async function getStickies(): Promise<Sticky[]> {
  return db.stickies.orderBy("position").toArray();
}

export async function getSticky(id: string): Promise<Sticky | undefined> {
  return db.stickies.get(id);
}

export async function createSticky(data?: Partial<Sticky>): Promise<Sticky> {
  const stickies = await db.stickies.orderBy("position").toArray();

  // If the newest sticky is empty, prevent creating another empty sticky (Plane behavior)
  if (stickies.length > 0) {
    const firstSticky = stickies[0];
    if (isStickyEmpty(firstSticky.contentHtml)) {
      throw new Error("ALREADY_EXISTS_EMPTY");
    }
  }

  const minPosition = stickies.length > 0 ? stickies[0].position : 0;
  const now = Date.now();

  const newSticky: Sticky = {
    id: data?.id ?? createId(),
    contentHtml: data?.contentHtml ?? "<p></p>",
    backgroundColor: data?.backgroundColor ?? getRandomStickyColor(),
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

    const [moved] = stickies.splice(activeIndex, 1);
    stickies.splice(overIndex, 0, moved);

    // Re-index positions uniformly
    const updates = stickies.map((s, index) =>
      db.stickies.update(s.id, { position: index * 1000 }),
    );
    await Promise.all(updates);
  });
}
