import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import type { Label, Task } from "@/lib/db/schema";
import type { WeekStartsOnPreference } from "../calendar/use-week-starts-on";

/**
 * Pure board-filter logic (normalize / toggle / match / apply), kept DOM-free
 * so the Node harness covers it directly. React + storage live in
 * `use-board-task-view.ts` (search in `use-board-search.ts`).
 */

// Mirrors the task-priority vocabulary in lib/db/schema (kept local so this
// module stays runnable in the plain Node harness without bundler aliases).

export const DUE_DATE_FILTER_VALUES = {
  dueThisWeek: "dueThisWeek",
  dueNextWeek: "dueNextWeek",
  noDueDate: "noDueDate",
} as const;

export type DueDateFilterValue =
  (typeof DUE_DATE_FILTER_VALUES)[keyof typeof DUE_DATE_FILTER_VALUES];

const PRIORITY_VALUES = [
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
] as const;

const DUE_DATE_VALUES = Object.values(DUE_DATE_FILTER_VALUES);

/** Filterable subjects; also the whole-subject (is-not) negatable set. */
export const BOARD_FILTER_SUBJECTS = [
  "status",
  "priority",
  "labels",
  "dueDate",
] as const;

export type BoardFilterSubject = (typeof BOARD_FILTER_SUBJECTS)[number];

export interface BoardFilters {
  /** Column identities (the lane-grouping key). */
  status: string[] | null;
  priority: string[] | null;
  /** Direct label identities. */
  labels: string[] | null;
  dueDate: DueDateFilterValue[] | null;
  negated: BoardFilterSubject[] | null;
}

export const EMPTY_BOARD_FILTERS: BoardFilters = {
  status: null,
  priority: null,
  labels: null,
  dueDate: null,
  negated: null,
};

export interface BoardFilterContext {
  query: string;
  today: Date;
  weekStartsOn: WeekStartsOnPreference;
}

/** Badge count: active subjects, not values; negation never inflates it. */
export function countActiveBoardFilters(filters: BoardFilters): number {
  return BOARD_FILTER_SUBJECTS.filter((key) => (filters[key]?.length ?? 0) > 0)
    .length;
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((item): item is string => typeof item === "string");
  return ids.length > 0 ? ids : null;
}

function stringListIn<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T[] | null {
  const kept = stringList(value)?.filter((item): item is T =>
    (allowed as readonly string[]).includes(item),
  );
  return kept && kept.length > 0 ? kept : null;
}

export function normalizeBoardFilters(raw: unknown): BoardFilters {
  if (!raw || typeof raw !== "object") return EMPTY_BOARD_FILTERS;
  const candidate = raw as Partial<Record<string, unknown>>;
  return {
    // Column identities are dynamic, so any string is kept.
    status: stringList(candidate.status),
    priority: stringListIn(candidate.priority, PRIORITY_VALUES),
    labels: stringList(candidate.labels),
    dueDate: stringListIn(candidate.dueDate, DUE_DATE_VALUES),
    negated: stringListIn(candidate.negated, BOARD_FILTER_SUBJECTS),
  };
}

export function toggleBoardFilterValue(
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

function matchesDueDateValue(
  task: Task,
  value: DueDateFilterValue,
  context: BoardFilterContext,
): boolean {
  if (value === DUE_DATE_FILTER_VALUES.noDueDate) return !task.dueDate;
  if (!task.dueDate) return false;
  const weeksAhead =
    value === DUE_DATE_FILTER_VALUES.dueThisWeek
      ? 0
      : value === DUE_DATE_FILTER_VALUES.dueNextWeek
        ? 1
        : null;
  if (weeksAhead === null) return false;
  // Local-midnight parse, same convention as parseDayString in
  // lib/due-date-status (yyyy-mm-dd carries no UTC shift in this app).
  const [year, month, day] = task.dueDate.split("-").map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    // Corrupt stored date: match nothing instead of throwing (date-fns
    // rejects Invalid Date), so the board never breaks on old data.
    return false;
  }
  const due = new Date(year, month - 1, day);
  const reference = addWeeks(context.today, weeksAhead);
  return isWithinInterval(due, {
    start: startOfWeek(reference, { weekStartsOn: context.weekStartsOn }),
    end: endOfWeek(reference, { weekStartsOn: context.weekStartsOn }),
  });
}

/**
 * Search ANDs with every active subject; within a subject any selected
 * value passes; a negated subject inverts its result; empty constrains
 * nothing. Status matches the lane-grouping key (column identity).
 */
export function taskMatchesBoardFilters(
  task: Task,
  taskLabelIds: string[] | undefined,
  filters: BoardFilters,
  context: BoardFilterContext,
): boolean {
  const query = context.query.trim().toLowerCase();
  if (query && !(task.title?.toLowerCase() ?? "").includes(query)) return false;

  const negated = new Set(filters.negated ?? []);
  const passes = (subject: BoardFilterSubject, matches: boolean) =>
    negated.has(subject) ? !matches : matches;

  if (
    filters.status?.length &&
    !passes("status", filters.status.includes(task.columnId))
  ) {
    return false;
  }
  if (
    filters.priority?.length &&
    !passes(
      "priority",
      filters.priority.includes(task.priority ?? "no-priority"),
    )
  ) {
    return false;
  }
  if (
    filters.labels?.length &&
    !passes(
      "labels",
      (taskLabelIds ?? []).some((id) => filters.labels?.includes(id)),
    )
  ) {
    return false;
  }
  if (
    filters.dueDate?.length &&
    !passes(
      "dueDate",
      filters.dueDate.some((value) =>
        matchesDueDateValue(task, value, context),
      ),
    )
  ) {
    return false;
  }
  return true;
}

function intersectGrouping(
  grouping: Map<string, Task[]>,
  labelsByTask: Map<string, Label[]>,
  matches: (task: Task, labelIds: string[] | undefined) => boolean,
): Map<string, Task[]> {
  const visible = new Map<string, Task[]>();
  for (const [columnId, columnTasks] of grouping) {
    visible.set(
      columnId,
      columnTasks.filter((task) =>
        matches(
          task,
          labelsByTask.get(task.id)?.map((label) => label.id),
        ),
      ),
    );
  }
  return visible;
}

/** Render-only intersection over the full v1 filter shape. */
export function filterBoardGrouping(
  grouping: Map<string, Task[]>,
  labelsByTask: Map<string, Label[]>,
  filters: BoardFilters,
  context: BoardFilterContext,
): Map<string, Task[]> {
  return intersectGrouping(grouping, labelsByTask, (task, labelIds) =>
    taskMatchesBoardFilters(task, labelIds, filters, context),
  );
}
