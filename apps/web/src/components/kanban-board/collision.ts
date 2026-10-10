import {
  type CollisionDetection,
  type DroppableContainer,
  closestCorners,
} from "@dnd-kit/core";

// Matches the board's `gap-3` lane spacing.
const COLUMN_GAP = 12;

type LaneData = {
  type?: string;
  taskIds?: string[];
};

/**
 * Pointer-based collision (mirrors Kaneo's board collision detection).
 * `closestCenter` flaps while a hover preview reorders the DOM under a
 * steady pointer (over A → preview moves A → over B → …), which feeds
 * setState back into itself. Scoping to the pointer's column first and
 * then to pointer-Y containment keeps `over` stable, so the preview
 * converges instead of oscillating.
 */
export const boardCollisionDetection: CollisionDetection = (args) => {
  const {
    pointerCoordinates: pointer,
    droppableContainers,
    droppableRects,
  } = args;
  if (!pointer) return closestCorners(args);

  let column: DroppableContainer | undefined;
  let columnDistance = COLUMN_GAP;
  for (const container of droppableContainers) {
    if ((container.data.current as LaneData | undefined)?.type !== "column") {
      continue;
    }
    const rect = droppableRects.get(container.id);
    if (!rect || pointer.y < rect.top || pointer.y > rect.bottom) continue;
    const distance = Math.max(rect.left - pointer.x, pointer.x - rect.right, 0);
    if (distance < columnDistance) {
      column = container;
      columnDistance = distance;
    }
  }
  const columnRect = column && droppableRects.get(column.id);
  if (!column || !columnRect) return [];

  let closest: { id: string } = { id: String(column.id) };
  let closestDistance = Number.POSITIVE_INFINITY;
  const taskIds =
    (column.data.current as LaneData | undefined)?.taskIds ?? [];
  for (const taskId of taskIds) {
    const rect = droppableRects.get(taskId);
    if (!rect || rect.bottom < columnRect.top || rect.top > columnRect.bottom) {
      continue;
    }
    const distance =
      pointer.y >= rect.top && pointer.y <= rect.bottom
        ? 0
        : Math.abs(rect.top + rect.height / 2 - pointer.y);
    if (distance < closestDistance) {
      closest = { id: taskId };
      closestDistance = distance;
    }
  }
  return [closest];
};
