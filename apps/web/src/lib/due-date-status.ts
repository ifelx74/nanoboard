import { format } from "date-fns";
import type { DueDateString, StartDateString } from "@/lib/db/schema";

export type DueDateStatus =
  | "overdue"
  | "due-soon"
  | "far-future"
  | "no-due-date";

/** Formats a local date as a `yyyy-mm-dd` day string (no UTC shift). */
export function toDayString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Parses a `yyyy-mm-dd` day string as a local date (no UTC shift). */
export function parseDayString(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day);
}

/** Kaneo's bar/overflow range label, even for single-day bars. */
export function formatDayRange(start: Date, end: Date): string {
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}

/** Kaneo's short drawer date: "Jan 5", no year. */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Kaneo-style relative chip label for list rows: Today / Tomorrow /
 * Yesterday / in N days / N days ago, short date beyond 30 days out.
 */
export function formatRelativeDueDate(due: Date, today = new Date()): string {
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const diff = Math.round(
    (startOfDay(due).getTime() - startOfDay(today).getTime()) / 86_400_000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff <= 30) return `in ${diff} days`;
  if (diff < -1) return `${Math.abs(diff)} days ago`;
  return formatDateShort(due);
}

/** Parses a `yyyy-mm-dd` day string as a local date (no UTC shift). */
export function parseLocalDate(isoDate: DueDateString | StartDateString): Date {
  return parseDayString(isoDate);
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
