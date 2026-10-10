import type { Label, Task } from "@/lib/db/schema";

/**
 * Pure board-filter logic (normalize / toggle / match / apply), kept DOM-free
 * so the Node harness covers it directly. React + storage live in
 * `use-board-label-filter.ts`.
 */
export function normalizeLabelFilter(raw: unknown): string[] | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = (raw as Partial<Record<"labels", unknown>>).labels;
  if (!Array.isArray(candidate)) return null;
  const ids = candidate.filter((item): item is string => typeof item === "string");
  return ids.length > 0 ? ids : null;
}

export function toggleLabelFilter(
  current: string[] | null,
  id: string,
): string[] | null {
  const ids = current ?? [];
  if (ids.includes(id)) {
    const next = ids.filter((candidate) => candidate !== id);
    return next.length > 0 ? next : null;
  }
  return [...ids, id];
}

/** `null` matches everything; otherwise match-any on the task's label ids. */
export function taskMatchesLabelFilter(
  taskLabelIds: string[] | undefined,
  selected: string[] | null,
): boolean {
  if (selected === null) return true;
  return (taskLabelIds ?? []).some((id) => selected.includes(id));
}

/** Render-only intersection: hidden tasks never reach the lanes. */
export function filterGrouping(
  grouping: Map<string, Task[]>,
  labelsByTask: Map<string, Label[]>,
  selected: string[] | null,
): Map<string, Task[]> {
  if (selected === null) return grouping;
  const visible = new Map<string, Task[]>();
  for (const [columnId, columnTasks] of grouping) {
    visible.set(
      columnId,
      columnTasks.filter((task) =>
        taskMatchesLabelFilter(
          labelsByTask.get(task.id)?.map((label) => label.id),
          selected,
        ),
      ),
    );
  }
  return visible;
}
