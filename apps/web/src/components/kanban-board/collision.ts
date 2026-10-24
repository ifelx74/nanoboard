import {
  type CollisionDetection,
  type DroppableContainer,
  closestCorners,
} from "@dnd-kit/core";
import { findLaneId } from "./locate";

// Matches the board's `gap-3` lane spacing.
const COLUMN_GAP = 12;

type LaneData = {
  type?: string;
  taskIds?: string[];
};

export const boardCollisionDetection: CollisionDetection = (args) => {
  const {
    pointerCoordinates: pointer,
    droppableContainers,
    droppableRects,
  } = args;
  if (!pointer) return closestCorners(args);

  const lanes: {
    id: string;
    rect: { top: number; bottom: number; left: number; right: number };
  }[] = [];
  const byId = new Map<string, DroppableContainer>();
  for (const container of droppableContainers) {
    if ((container.data.current as LaneData | undefined)?.type !== "column") {
      continue;
    }
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    lanes.push({ id: String(container.id), rect });
    byId.set(String(container.id), container);
  }
  const laneId = findLaneId(lanes, pointer, COLUMN_GAP);
  const column = laneId ? byId.get(laneId) : undefined;
  const columnRect = column && droppableRects.get(column.id);
  if (!column || !columnRect) return [];

  let closest: { id: string } = { id: String(column.id) };
  let closestDistance = Number.POSITIVE_INFINITY;
  const taskIds = (column.data.current as LaneData | undefined)?.taskIds ?? [];
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
