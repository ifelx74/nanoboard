// Client-side data shapes.
// (no workspace, auth/session, or user references). Timestamps are epoch
// milliseconds; start/due dates stay `yyyy-mm-dd` strings so board/list/calendar
// grouping works unchanged.

export const TASK_PRIORITIES = [
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

declare const columnSlugBrand: unique symbol;
/** Stable column identity; branded so slugs can't mix with display names. */
export type ColumnSlug = string & { readonly [columnSlugBrand]: true };

/** Central brand assertion: the single place a plain string becomes a slug. */
export function columnSlug(value: string): ColumnSlug {
  return value as ColumnSlug;
}

declare const dueDateBrand: unique symbol;
/** Calendar-day string in `yyyy-mm-dd` form. */
export type DueDateString = string & { readonly [dueDateBrand]: true };

declare const startDateBrand: unique symbol;
/** Calendar-day string in `yyyy-mm-dd` form; never after the task's dueDate. */
export type StartDateString = string & { readonly [startDateBrand]: true };

/** Central brand assertion: the single place a plain string becomes a start date. */
export function startDate(value: string): StartDateString {
  return value as StartDateString;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  position: number;
  lastTaskNumber: number;
  createdAt: number;
  updatedAt: number;
}

export interface Column {
  id: string;
  projectId: string;
  name: string;
  /** Stable identity (e.g. "to-do"); display name may change freely. */
  slug: ColumnSlug;
  position: number;
  isFinal: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  columnId: string;
  /** Mirrors the parent column's slug; always written in sync with columnId. */
  status: ColumnSlug;
  title: string;
  description: string;
  position: number;
  /** Per-project sequential number, allocated from project.lastTaskNumber. */
  number: number;
  priority: TaskPriority;
  /** ISO date string (yyyy-mm-dd) */
  startDate?: StartDateString;
  /** ISO date string (yyyy-mm-dd) */
  dueDate?: DueDateString;
  createdAt: number;
  updatedAt: number;
}

export interface Label {
  id: string;
  /** Palette scope: labels belong to exactly one project. */
  projectId: string;
  name: string;
  /** One of the LABEL_COLORS values. */
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface TaskLabel {
  /** Assignment join; the compound key makes re-attach a store-level no-op. */
  taskId: string;
  labelId: string;
}

export interface TaskResource {
  id: string;
  taskId: string;
  /**
   * Always `"url"` here — Kaneo's manual-link row shape minus the
   * integration columns, which cannot exist without a server.
   */
  resourceType: string;
  /** Mirrors `url` for manual links; Kaneo's display fallback. */
  externalId: string;
  url: string;
  title: string | null;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_PROJECT_ICON = "Layout";

export const DEFAULT_COLUMNS: {
  name: string;
  slug: ColumnSlug;
  position: number;
  isFinal: boolean;
}[] = [
  { name: "Backlog", slug: columnSlug("backlog"), position: 0, isFinal: false },
  { name: "To Do", slug: columnSlug("to-do"), position: 1, isFinal: false },
  { name: "In Progress", slug: columnSlug("in-progress"), position: 2, isFinal: false },
  { name: "In Review", slug: columnSlug("in-review"), position: 3, isFinal: false },
  { name: "Completed", slug: columnSlug("done"), position: 4, isFinal: true },
];

export const STICKY_COLORS = [
  "gray",
  "peach",
  "pink",
  "orange",
  "green",
  "light-blue",
  "dark-blue",
  "purple",
] as const;

export type StickyColorKey = (typeof STICKY_COLORS)[number];

export interface Sticky {
  id: string;
  contentHtml: string;
  backgroundColor: StickyColorKey;
  position: number;
  createdAt: number;
  updatedAt: number;
}

