// Client-side data shapes.
// (no workspace, auth/session, or user references). Timestamps are epoch
// milliseconds; due dates stay `yyyy-mm-dd` strings so board/list/calendar
// grouping works unchanged. Start dates arrive in v2.

export type TaskPriority =
  | "no-priority"
  | "low"
  | "medium"
  | "high"
  | "urgent";

declare const columnSlugBrand: unique symbol;
/** Stable column identity; branded so slugs can't mix with display names. */
export type ColumnSlug = string & { readonly [columnSlugBrand]: true };

declare const dueDateBrand: unique symbol;
/** Calendar-day string in `yyyy-mm-dd` form. */
export type DueDateString = string & { readonly [dueDateBrand]: true };

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
  dueDate?: DueDateString;
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
  { name: "To Do", slug: "to-do" as ColumnSlug, position: 0, isFinal: false },
  { name: "In Progress", slug: "in-progress" as ColumnSlug, position: 1, isFinal: false },
  { name: "In Review", slug: "in-review" as ColumnSlug, position: 2, isFinal: false },
  { name: "Done", slug: "done" as ColumnSlug, position: 3, isFinal: true },
];
