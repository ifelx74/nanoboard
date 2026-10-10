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
  slug: string;
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
  status: string;
  title: string;
  description: string;
  position: number;
  /** Per-project sequential number, allocated from project.lastTaskNumber. */
  number: number;
  priority: TaskPriority;
  /** ISO date string (yyyy-mm-dd) */
  dueDate?: string;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_PROJECT_ICON = "Layout";

export const DEFAULT_COLUMNS = [
  { name: "To Do", slug: "to-do", position: 0, isFinal: false },
  { name: "In Progress", slug: "in-progress", position: 1, isFinal: false },
  { name: "In Review", slug: "in-review", position: 2, isFinal: false },
  { name: "Done", slug: "done", position: 3, isFinal: true },
] as const;
