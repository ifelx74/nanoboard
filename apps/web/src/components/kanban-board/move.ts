import type { Column, ColumnSlug, Task } from "@/lib/db/schema";

export interface MoveDirtyItem {
  id: string;
  position: number;
  status?: ColumnSlug;
}

export interface MoveResult {
  grouping: Map<string, Task[]>;
  dirty: MoveDirtyItem[];
}

/**
 * Pure board-move computation (mirrors Kaneo's move-task core, minus
 * immer and server-only concerns). Removes the active task from its
 * column, inserts it at the hovered position in the destination column,
 * renumbers touched columns dense 0..n, and returns only the rows whose
 * position or column changed. Used for hover preview AND the drop write,
 * so preview and commit can never disagree.
 */
export function computeMove(
  grouping: Map<string, Task[]>,
  columns: Column[],
  activeId: string,
  overId: string,
  insertAfterTarget?: boolean,
): MoveResult | null {
  const sourceColumnId = findColumnId(grouping, activeId);
  const destination =
    columns.find((column) => column.id === overId) ??
    columns.find((column) =>
      (grouping.get(column.id) ?? []).some((task) => task.id === overId),
    );
  if (!sourceColumnId || !destination || activeId === overId) return null;

  const next = new Map<string, Task[]>();
  for (const [columnId, list] of grouping) {
    next.set(
      columnId,
      list.map((task) => ({ ...task })),
    );
  }

  const from = next.get(sourceColumnId) ?? [];
  const to = next.get(destination.id) ?? [];
  const sourceIndex = from.findIndex((task) => task.id === activeId);
  if (sourceIndex === -1) return null;
  const [task] = from.splice(sourceIndex, 1);
  if (!task) return null;
  task.status = destination.slug;
  task.columnId = destination.id;
  next.set(sourceColumnId, from);

  let index =
    overId === destination.id
      ? to.length
      : to.findIndex((candidate) => candidate.id === overId);
  if (index === -1) index = to.length;
  if (overId !== destination.id) {
    if (insertAfterTarget !== undefined) {
      index += insertAfterTarget ? 1 : 0;
    } else if (sourceColumnId !== destination.id || sourceIndex <= index) {
      index += 1;
    }
  }
  to.splice(index, 0, task);
  next.set(destination.id, to);

  const touched = new Set([sourceColumnId, destination.id]);
  for (const columnId of touched) {
    (next.get(columnId) ?? []).forEach((entry, position) => {
      entry.position = position;
    });
  }

  const previous = new Map<string, Task>();
  for (const list of grouping.values()) {
    for (const entry of list) previous.set(entry.id, entry);
  }
  const dirty: MoveDirtyItem[] = [];
  for (const list of next.values()) {
    for (const entry of list) {
      const old = previous.get(entry.id);
      if (!old) continue;
      if (old.columnId !== entry.columnId) {
        dirty.push({
          id: entry.id,
          position: entry.position,
          status: entry.status,
        });
      } else if (old.position !== entry.position) {
        dirty.push({ id: entry.id, position: entry.position });
      }
    }
  }
  return { grouping: next, dirty };
}

function findColumnId(
  grouping: Map<string, Task[]>,
  taskId: string,
): string | undefined {
  for (const [columnId, list] of grouping) {
    if (list.some((task) => task.id === taskId)) return columnId;
  }
  return undefined;
}
