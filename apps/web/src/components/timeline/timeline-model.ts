import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  isSameDay,
  isWeekend,
  startOfDay,
  subDays,
} from "date-fns";

/** Fixed logical scale: every day column is this many pixels wide. */
export const DAY_WIDTH = 40;
/** Sidebar and row geometry, shared with the chart component. */
export const ROW_HEIGHT = 44;
export const BAR_HEIGHT = 28;
export const SIDEBAR_WIDTH = 300;
/**
 * The visible axis is never narrower than this, centred so the anchor day
 * always stays on screen even for sparse projects.
 */
export const MIN_WINDOW_DAYS = 28;
/** Days before the anchor included in the minimum window. */
const WINDOW_DAYS_BEFORE_ANCHOR = 13;

export type TimelineTaskInput = {
  id: string;
  /** `yyyy-mm-dd` day string; absent when the task has no start date. */
  startDate?: string;
  /** `yyyy-mm-dd` day string; absent when the task has no due date. */
  dueDate?: string;
  position: number;
};

export type TimelineDay = {
  index: number;
  date: Date;
  isWeekend: boolean;
  isToday: boolean;
};

export type TimelineMonth = {
  /** `yyyy-mm` key. */
  key: string;
  /** First of the month, for label formatting. */
  date: Date;
  startIndex: number;
  dayCount: number;
};

export type TimelineRow<TTask extends TimelineTaskInput> = {
  task: TTask & { chartStart: Date; chartEnd: Date };
  startIndex: number;
  spanDays: number;
  /** Pixel offset of the bar's left edge within the chart. */
  left: number;
  /** Pixel width of the bar. */
  width: number;
};

export type TimelineModel<TTask extends TimelineTaskInput> = {
  days: TimelineDay[];
  months: TimelineMonth[];
  rows: TimelineRow<TTask>[];
  /** Width of the chart area in pixels (`days.length * DAY_WIDTH`). */
  chartWidth: number;
  /** Tasks without any date; shown nowhere, only counted. */
  undatedCount: number;
};

export type TimelineDragMode = "move" | "resize-start" | "resize-end";

/** The date fields a drag changes; absent fields keep their prior state. */
export type TimelineDragResult = {
  startDate?: string;
  dueDate?: string;
};

/** Maps `-0` to `0` so day-quantised deltas never render as negative zero. */
function normalizeNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/**
 * Day snapping for a drag: move keeps the delta, and the dragged edge of a
 * resize may not pass the other edge (a bar never shrinks below one day).
 * `spanDays` is the bar's current inclusive span.
 */
export function clampDragDayDelta(
  mode: TimelineDragMode,
  spanDays: number,
  dayDelta: number,
): number {
  if (mode === "move") return dayDelta;
  const maxShrink = Math.max(0, spanDays - 1);
  if (mode === "resize-start") {
    return normalizeNegativeZero(Math.min(dayDelta, maxShrink));
  }
  return normalizeNegativeZero(Math.max(dayDelta, -maxShrink));
}

/**
 * Day-quantised date changes for a drag, given the task's current dates.
 * Move shifts every existing date by the delta (duration preserved; a
 * single-dated task shifts its lone date). Resize moves the dragged edge —
 * setting the missing endpoint on a single-dated bar — clamped so the range
 * never inverts and the bar stays at least one day. Returns only the fields
 * the drag changes; an undated task gets `{}`.
 */
export function applyDragDelta(
  task: Pick<TimelineTaskInput, "startDate" | "dueDate">,
  mode: TimelineDragMode,
  dayDelta: number,
): TimelineDragResult {
  const span = normalizeTaskSpan(task);
  if (!span) return {};
  const spanDays = differenceInCalendarDays(span.chartEnd, span.chartStart) + 1;
  const delta = clampDragDayDelta(mode, spanDays, dayDelta);
  const shift = (value: string): string =>
    formatDay(addDays(parseDay(value), delta));

  if (mode === "move") {
    const result: TimelineDragResult = {};
    if (task.startDate !== undefined) result.startDate = shift(task.startDate);
    if (task.dueDate !== undefined) result.dueDate = shift(task.dueDate);
    return result;
  }

  if (mode === "resize-start") {
    // A due-only bar gains its missing start endpoint here.
    const anchor = task.startDate ?? task.dueDate;
    return { startDate: shift(anchor as string) };
  }

  // A start-only bar gains its missing due endpoint here.
  const anchor = task.dueDate ?? task.startDate;
  return { dueDate: shift(anchor as string) };
}

/** Formats a local date as a `yyyy-mm-dd` day string (no UTC shift). */
function formatDay(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parses a `yyyy-mm-dd` day string as a local date (no UTC shift). */
function parseDay(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/**
 * Normalises a task's two optional dates to an inclusive local-day span:
 * `start = startDate ?? dueDate`, `end = dueDate ?? startDate`, swapping if
 * the raw strings are inverted. Undated tasks return `null`.
 */
function normalizeTaskSpan(
  task: Pick<TimelineTaskInput, "startDate" | "dueDate">,
): { chartStart: Date; chartEnd: Date } | null {
  const rawStart = task.startDate ? parseDay(task.startDate) : undefined;
  const rawEnd = task.dueDate ? parseDay(task.dueDate) : undefined;
  const first = rawStart ?? rawEnd;
  const last = rawEnd ?? rawStart;
  if (!first || !last) return null;
  if (first <= last) return { chartStart: first, chartEnd: last };
  return { chartStart: last, chartEnd: first };
}

function scheduleTask<TTask extends TimelineTaskInput>(
  task: TTask,
): (TTask & { chartStart: Date; chartEnd: Date }) | null {
  const span = normalizeTaskSpan(task);
  if (!span) return null;
  return { ...task, ...span };
}

/**
 * Builds the full read model for the Timeline: the visible day range (the
 * union of scheduled spans clamped to a minimum window centred on `anchor`,
 * so `anchor` is always inside), the ordered rows with bar geometry, the
 * header day/month payloads, and the count of undated tasks.
 */
export function buildTimeline<TTask extends TimelineTaskInput>(
  tasks: TTask[],
  anchor: Date = new Date(),
): TimelineModel<TTask> {
  const dayAnchor = startOfDay(anchor);
  const windowStart = subDays(dayAnchor, WINDOW_DAYS_BEFORE_ANCHOR);
  const windowEnd = addDays(
    dayAnchor,
    MIN_WINDOW_DAYS - 1 - WINDOW_DAYS_BEFORE_ANCHOR,
  );

  const scheduled: Array<TTask & { chartStart: Date; chartEnd: Date }> = [];
  let undatedCount = 0;
  for (const task of tasks) {
    const row = scheduleTask(task);
    if (row) scheduled.push(row);
    else undatedCount += 1;
  }

  let unionStart: Date | undefined;
  let unionEnd: Date | undefined;
  for (const task of scheduled) {
    if (!unionStart || task.chartStart < unionStart)
      unionStart = task.chartStart;
    if (!unionEnd || task.chartEnd > unionEnd) unionEnd = task.chartEnd;
  }

  const rangeStart =
    unionStart && unionStart < windowStart ? unionStart : windowStart;
  const rangeEnd = unionEnd && unionEnd > windowEnd ? unionEnd : windowEnd;

  const dayList = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const days: TimelineDay[] = dayList.map((date, index) => ({
    index,
    date,
    isWeekend: isWeekend(date),
    isToday: isSameDay(date, dayAnchor),
  }));

  const months: TimelineMonth[] = [];
  for (const day of days) {
    const key = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, "0")}`;
    const current = months.at(-1);
    if (current?.key === key) {
      current.dayCount += 1;
      continue;
    }
    months.push({
      key,
      date: new Date(day.date.getFullYear(), day.date.getMonth(), 1),
      startIndex: day.index,
      dayCount: 1,
    });
  }

  const rows = scheduled
    .map((task) => {
      const startIndex = differenceInCalendarDays(task.chartStart, rangeStart);
      const spanDays =
        differenceInCalendarDays(task.chartEnd, task.chartStart) + 1;
      return {
        task,
        startIndex,
        spanDays,
        left: startIndex * DAY_WIDTH,
        width: spanDays * DAY_WIDTH,
      };
    })
    .sort((left, right) => {
      const byStart =
        left.task.chartStart.getTime() - right.task.chartStart.getTime();
      if (byStart !== 0) return byStart;
      const byEnd =
        left.task.chartEnd.getTime() - right.task.chartEnd.getTime();
      if (byEnd !== 0) return byEnd;
      return left.task.position - right.task.position;
    });

  return {
    days,
    months,
    rows,
    chartWidth: days.length * DAY_WIDTH,
    undatedCount,
  };
}
