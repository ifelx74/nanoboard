import type { DueDateString } from "@/lib/db/schema";

export type DueDateStatus =
  | "overdue"
  | "due-soon"
  | "far-future"
  | "no-due-date";

/** Parses a `yyyy-mm-dd` day string as a local date (no UTC shift). */
export function parseLocalDate(isoDate: DueDateString): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getDueDateStatus(
  dueDate: DueDateString | null | undefined,
  isCompleted = false,
): DueDateStatus {
  if (!dueDate) return "no-due-date";
  // A finished task cannot be late, so it keeps the neutral badge.
  if (isCompleted) return "far-future";

  const now = new Date();
  const due = new Date(dueDate);
  const diffInDays = Math.ceil(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffInDays < 0) return "overdue";
  if (diffInDays <= 3) return "due-soon";
  return "far-future";
}
