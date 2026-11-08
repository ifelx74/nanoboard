import { addDays, startOfDay } from "date-fns";
import type { DueDateString } from "@/lib/db/schema";
import { toDayString } from "@/lib/due-date-status";

/** A task as the home week strip needs it: project key + ticket number joined. */
export type WeekStripTask = {
  id: string;
  title: string;
  number: number;
  projectId: string;
  projectSlug: string;
  dueDate?: DueDateString;
};

export type WeekDay = {
  date: Date;
  isToday: boolean;
  isPast: boolean;
  tasks: WeekStripTask[];
};

const DAYS_BEFORE = 3;
const DAYS_AFTER = 3;

/** Inclusive due-date window the strip queries for, centred on `now`. */
export function weekWindow(now = new Date()): {
  from: DueDateString;
  to: DueDateString;
} {
  const start = startOfDay(now);
  return {
    from: toDayString(addDays(start, -DAYS_BEFORE)) as DueDateString,
    to: toDayString(addDays(start, DAYS_AFTER)) as DueDateString,
  };
}

// Centred on today: the days just missed matter as much as the ones coming up.
export function buildWeek(tasks: WeekStripTask[], now = new Date()): WeekDay[] {
  const today = startOfDay(now);

  return Array.from({ length: DAYS_BEFORE + DAYS_AFTER + 1 }, (_, index) => {
    const offset = index - DAYS_BEFORE;
    const date = addDays(today, offset);

    return {
      date,
      isToday: offset === 0,
      isPast: offset < 0,
      tasks: tasks.filter(
        (task) => task.dueDate && task.dueDate === toDayString(date),
      ),
    };
  });
}
