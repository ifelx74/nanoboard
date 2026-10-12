import type { Task } from "@/lib/db/schema";

/**
 * Pure drop-preview helpers for the kanban board, kept DOM-free so a Node
 * harness covers them directly. React state lives in `kanban-board.tsx`.
 *
 * A drop preview is optimistic UI: after `onDragEnd` it owns the view until
 * the live IndexedDB echo lands, so the overlay settles into its new slot
 * instead of flying home. Two invariants keep it from swallowing real data:
 *
 * 1. Keys are deterministic (column-sorted). `groupTasks` builds its Map in
 *    first-seen-task order and the tasks query returns rows in `projectId`
 *    index order (random cuids), so Map insertion order is arbitrary — an
 *    order-sensitive key would never match its echo and the preview would
 *    stick forever.
 * 2. Concurrent writes never block the handoff. A task created while a
 *    preview is held adds an id the preview can never contain; requiring
 *    exact key equality would again stick the preview, leaving the new task
 *    in the store but invisible until reload. The echo check therefore
 *    tolerates extra live tasks, and the merged view renders them even
 *    while the preview is held.
 */
export function groupingKey(grouping: Map<string, Task[]>): string {
  return [...grouping.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(
      ([columnId, list]) =>
        `${columnId}:${list.map((task) => task.id).join(",")}`,
    )
    .join("|");
}

/**
 * True once live data has echoed the previewed order: every previewed task
 * still present in the store sits in its preview column, and the relative
 * order of previewed ids within each column matches. Live-only tasks
 * (created during the echo window) are ignored; preview-only ids that left
 * the store (deleted) are skipped rather than ghosted.
 */
export function isPreviewEchoed(
  live: Map<string, Task[]>,
  preview: Map<string, Task[]>,
): boolean {
  const liveColumnOf = new Map<string, string>();
  const liveIdsByColumn = new Map<string, string[]>();
  for (const [columnId, list] of live) {
    liveIdsByColumn.set(
      columnId,
      list.map((task) => task.id),
    );
    for (const task of list) liveColumnOf.set(task.id, columnId);
  }
  for (const [columnId, list] of preview) {
    const wanted = list
      .map((task) => task.id)
      .filter((id) => liveColumnOf.has(id));
    for (const id of wanted) {
      if (liveColumnOf.get(id) !== columnId) return false;
    }
    const present = (liveIdsByColumn.get(columnId) ?? []).filter((id) =>
      wanted.includes(id),
    );
    if (present.join(",") !== wanted.join(",")) return false;
  }
  return true;
}

/**
 * Union of a held preview with fresh live data for rendering. The preview
 * owns the order of the tasks it knows (the optimistic drop); overlapping
 * ids render their live objects under the optimistic column, and any live
 * task the preview has never seen is appended to its live column — so a
 * create landing mid-echo is visible immediately instead of hiding behind
 * the stale snapshot.
 */
export function mergePreviewLive(
  live: Map<string, Task[]>,
  preview: Map<string, Task[]>,
): Map<string, Task[]> {
  const liveById = new Map<string, Task>();
  for (const list of live.values()) {
    for (const task of list) liveById.set(task.id, task);
  }
  const previewIds = new Set<string>();
  for (const list of preview.values()) {
    for (const task of list) previewIds.add(task.id);
  }
  const merged = new Map<string, Task[]>();
  for (const [columnId, list] of preview) {
    const out: Task[] = [];
    for (const task of list) {
      const fresh = liveById.get(task.id);
      if (!fresh) continue;
      out.push(
        fresh.columnId === columnId
          ? fresh
          : { ...fresh, columnId, status: task.status },
      );
    }
    merged.set(columnId, out);
  }
  for (const [columnId, list] of live) {
    if (!merged.has(columnId)) merged.set(columnId, []);
    const target = merged.get(columnId) as Task[];
    for (const task of list) {
      if (!previewIds.has(task.id)) target.push(task);
    }
  }
  return merged;
}
