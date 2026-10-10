import type { Column } from "@/lib/db/schema";

export interface Pointer {
  x: number;
  y: number;
}

export interface DropTarget {
  overId: string;
  insertAfter?: boolean;
}

/**
 * Pointer-derived drop target using live DOM rects. Unlike dnd-kit's
 * `over` identity (which flaps while a hover preview reorders the DOM
 * underneath it), this is a pure function of pointer position: a steady
 * pointer always resolves the same target, so preview updates converge
 * instead of oscillating into an update-depth loop.
 */
export function locateFromPointer(
  laneEls: Map<string, HTMLElement | null>,
  columns: Column[],
  activeId: string,
  pointer: Pointer,
): DropTarget | null {
  let laneId: string | null = null;
  let laneDistance = 12;
  for (const column of columns) {
    const el = laneEls.get(column.id);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (pointer.y < rect.top || pointer.y > rect.bottom) continue;
    const distance = Math.max(rect.left - pointer.x, pointer.x - rect.right, 0);
    if (distance < laneDistance) {
      laneId = column.id;
      laneDistance = distance;
    }
  }
  if (!laneId) return null;

  const laneEl = laneEls.get(laneId);
  const cards = laneEl
    ? Array.from(laneEl.querySelectorAll<HTMLElement>("[data-task-id]"))
    : [];
  let best: DropTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const card of cards) {
    const id = card.dataset.taskId;
    if (!id || id === activeId) continue;
    const rect = card.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const distance = Math.abs(centerY - pointer.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { overId: id, insertAfter: pointer.y > centerY };
    }
  }
  return best ?? { overId: laneId };
}
