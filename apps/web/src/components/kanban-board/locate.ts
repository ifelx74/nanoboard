import type { Column } from "@/lib/db/schema";

export interface Pointer {
  x: number;
  y: number;
}

export interface DropTarget {
  overId: string;
  /** Pointer-resolved before/after; "auto" defers to the default rule. */
  placeAfter: boolean | "auto";
}

export interface LaneRect {
  id: string;
  rect: { top: number; bottom: number; left: number; right: number };
}

/**
 * Shared lane picker: nearest lane containing the pointer's Y band,
 * ties broken by horizontal distance. Used by both the pointer locator
 * below and the dnd-kit collision handler so the two can never disagree
 * on which lane owns a point.
 */
export function findLaneId(
  lanes: LaneRect[],
  pointer: Pointer,
  gap: number,
): string | null {
  let laneId: string | null = null;
  let laneDistance = gap;
  for (const lane of lanes) {
    if (pointer.y < lane.rect.top || pointer.y > lane.rect.bottom) continue;
    const distance = Math.max(
      lane.rect.left - pointer.x,
      pointer.x - lane.rect.right,
      0,
    );
    if (distance < laneDistance) {
      laneId = lane.id;
      laneDistance = distance;
    }
  }
  return laneId;
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
  const laneId = findLaneId(
    columns.flatMap((column) => {
      const el = laneEls.get(column.id);
      return el ? [{ id: column.id, rect: el.getBoundingClientRect() }] : [];
    }),
    pointer,
    12,
  );
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
      best = { overId: id, placeAfter: pointer.y > centerY };
    }
  }
  return best ?? { overId: laneId, placeAfter: "auto" as const };
}
