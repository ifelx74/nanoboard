import { describe, expect, it } from "vitest";
import {
  DAY_WIDTH,
  MIN_WINDOW_DAYS,
  applyDragDelta,
  buildTimeline,
  clampDragDayDelta,
  type TimelineTaskInput,
} from "./timeline-model";

const anchor = new Date(2026, 9, 19); // Monday, Oct 19 2026
// Minimum window: [anchor - 13 days, anchor + 14 days] so the anchor is
// always inside and the window is 28 days wide.
const WINDOW_START = new Date(2026, 9, 6);
const WINDOW_END = new Date(2026, 10, 2);

function task(
  id: string,
  startDate: string | undefined,
  dueDate: string | undefined,
  position = 0,
): TimelineTaskInput {
  return { id, startDate, dueDate, position };
}

describe("buildTimeline range", () => {
  it("falls back to a minimum window centred on the anchor when there are no tasks", () => {
    const model = buildTimeline([], anchor);

    expect(model.days).toHaveLength(MIN_WINDOW_DAYS);
    expect(model.days[0].date).toEqual(WINDOW_START);
    expect(model.days.at(-1)?.date).toEqual(WINDOW_END);
    expect(model.days[13].isToday).toBe(true);
    expect(model.days.filter((day) => day.isToday)).toHaveLength(1);
    expect(model.chartWidth).toBe(MIN_WINDOW_DAYS * DAY_WIDTH);
    expect(model.rows).toHaveLength(0);
    expect(model.undatedCount).toBe(0);
  });

  it("keeps the minimum window when every task fits inside it", () => {
    const model = buildTimeline(
      [task("a", "2026-10-10", "2026-10-15")],
      anchor,
    );

    expect(model.days[0].date).toEqual(WINDOW_START);
    expect(model.days.at(-1)?.date).toEqual(WINDOW_END);
    expect(model.days.some((day) => day.isToday)).toBe(true);
  });

  it("expands the range to the union of scheduled spans when they exceed the window", () => {
    const model = buildTimeline(
      [
        task("early", "2026-08-03", "2026-08-20"),
        task("late", "2026-12-07", "2026-12-31"),
      ],
      anchor,
    );

    expect(model.days[0].date).toEqual(new Date(2026, 7, 3));
    expect(model.days.at(-1)?.date).toEqual(new Date(2026, 11, 31));
  });

  it("expands asymmetrically: only the side the union reaches past grows", () => {
    const model = buildTimeline(
      [task("early", "2026-09-01", "2026-10-25")],
      anchor,
    );

    expect(model.days[0].date).toEqual(new Date(2026, 8, 1));
    expect(model.days.at(-1)?.date).toEqual(WINDOW_END);
  });
});

describe("buildTimeline spans and ordering", () => {
  it("renders single-dated tasks as one-day bars on their known date", () => {
    const onlyDue = buildTimeline([task("d", undefined, "2026-10-22")], anchor);
    const onlyStart = buildTimeline(
      [task("s", "2026-10-22", undefined)],
      anchor,
    );

    expect(onlyDue.rows[0].task.chartStart).toEqual(new Date(2026, 9, 22));
    expect(onlyDue.rows[0].task.chartEnd).toEqual(new Date(2026, 9, 22));
    expect(onlyDue.rows[0].width).toBe(DAY_WIDTH);
    expect(onlyStart.rows[0].task.chartStart).toEqual(new Date(2026, 9, 22));
    expect(onlyStart.rows[0].width).toBe(DAY_WIDTH);
  });

  it("swaps inverted start/due dates instead of rendering backwards", () => {
    const model = buildTimeline(
      [task("inverted", "2026-10-25", "2026-10-12")],
      anchor,
    );

    expect(model.rows[0].task.chartStart).toEqual(new Date(2026, 9, 12));
    expect(model.rows[0].task.chartEnd).toEqual(new Date(2026, 9, 25));
  });

  it("orders rows by (start, due, position)", () => {
    const model = buildTimeline(
      [
        task("c", "2026-10-20", "2026-10-28", 0),
        task("a", "2026-10-06", "2026-10-09", 5),
        task("b1", "2026-10-20", "2026-10-22", 3),
        task("b2", "2026-10-20", "2026-10-22", 1),
      ],
      anchor,
    );

    expect(model.rows.map((row) => row.task.id)).toEqual([
      "a",
      "b2",
      "b1",
      "c",
    ]);
  });

  it("orders single-dated tasks by their known date", () => {
    const model = buildTimeline(
      [
        task("late", undefined, "2026-10-30"),
        task("early", undefined, "2026-10-08"),
      ],
      anchor,
    );

    expect(model.rows.map((row) => row.task.id)).toEqual(["early", "late"]);
  });

  it("excludes undated tasks from rows and counts them", () => {
    const model = buildTimeline(
      [
        task("dated", "2026-10-10", "2026-10-12"),
        task("undated-a", undefined, undefined),
        task("undated-b", undefined, undefined),
      ],
      anchor,
    );

    expect(model.rows.map((row) => row.task.id)).toEqual(["dated"]);
    expect(model.undatedCount).toBe(2);
  });
});

describe("buildTimeline columns", () => {
  it("flags weekend columns and leaves weekdays unflagged", () => {
    const model = buildTimeline([], anchor);
    const byDate = new Map(model.days.map((day) => [day.date.getDate(), day]));

    // October 2026: Saturdays fall on 3, 10, 17, 24, 31.
    expect(byDate.get(17)?.isWeekend).toBe(true);
    expect(byDate.get(24)?.isWeekend).toBe(true);
    expect(byDate.get(19)?.isWeekend).toBe(false);
  });

  it("splits the header into month segments with correct day spans", () => {
    const model = buildTimeline(
      [task("long", "2026-09-20", "2026-10-20")],
      anchor,
    );

    expect(
      model.months.map((month) => ({
        key: month.key,
        startIndex: month.startIndex,
        dayCount: month.dayCount,
      })),
    ).toEqual([
      { key: "2026-09", startIndex: 0, dayCount: 11 },
      { key: "2026-10", startIndex: 11, dayCount: 31 },
      { key: "2026-11", startIndex: 42, dayCount: 2 },
    ]);
  });

  it("marks the first day of each month segment at the clamped range edge", () => {
    const model = buildTimeline(
      [task("mid", "2026-10-10", "2026-11-15")],
      anchor,
    );

    const november = model.months.find((month) => month.key === "2026-11");
    expect(november?.startIndex).toBe(
      model.days.findIndex(
        (day) => day.date.getMonth() === 10 && day.date.getDate() === 1,
      ),
    );
  });
});

describe("buildTimeline geometry", () => {
  it("positions a multi-day bar from its span", () => {
    const model = buildTimeline(
      [task("span", "2026-10-12", "2026-10-14")],
      anchor,
    );
    const rangeStart = model.days[0].date;
    const expectedLeft =
      Math.round(
        (new Date(2026, 9, 12).getTime() - rangeStart.getTime()) / 86_400_000,
      ) * DAY_WIDTH;

    expect(model.rows[0].left).toBe(expectedLeft);
    expect(model.rows[0].width).toBe(3 * DAY_WIDTH);
  });
});

describe("clampDragDayDelta", () => {
  it("returns the delta unchanged for move drags", () => {
    expect(clampDragDayDelta("move", 5, 3)).toBe(3);
    expect(clampDragDayDelta("move", 5, -12)).toBe(-12);
    expect(clampDragDayDelta("move", 1, 7)).toBe(7);
  });

  it("clamps resize-start drags so the left edge never passes the right edge", () => {
    expect(clampDragDayDelta("resize-start", 5, 99)).toBe(4);
    expect(clampDragDayDelta("resize-start", 5, 4)).toBe(4);
    expect(clampDragDayDelta("resize-start", 5, 2)).toBe(2);
    expect(clampDragDayDelta("resize-start", 5, -99)).toBe(-99);
  });

  it("clamps resize-end drags so the right edge never passes the left edge", () => {
    expect(clampDragDayDelta("resize-end", 5, -99)).toBe(-4);
    expect(clampDragDayDelta("resize-end", 5, -4)).toBe(-4);
    expect(clampDragDayDelta("resize-end", 5, -2)).toBe(-2);
    expect(clampDragDayDelta("resize-end", 5, 99)).toBe(99);
  });

  it("pins both edges of a one-day bar for resize drags", () => {
    expect(clampDragDayDelta("resize-start", 1, 3)).toBe(0);
    expect(clampDragDayDelta("resize-start", 1, -3)).toBe(-3);
    expect(clampDragDayDelta("resize-end", 1, -3)).toBe(0);
    expect(clampDragDayDelta("resize-end", 1, 3)).toBe(3);
  });
});

describe("applyDragDelta move", () => {
  it("shifts both dates together, preserving duration", () => {
    expect(
      applyDragDelta(task("m", "2026-10-12", "2026-10-14"), "move", 3),
    ).toEqual({ startDate: "2026-10-15", dueDate: "2026-10-17" });
  });

  it("shifts both dates backwards for negative deltas", () => {
    expect(
      applyDragDelta(task("m", "2026-10-12", "2026-10-14"), "move", -5),
    ).toEqual({ startDate: "2026-10-07", dueDate: "2026-10-09" });
  });

  it("shifts only the due date of a due-only task", () => {
    expect(
      applyDragDelta(task("d", undefined, "2026-10-22"), "move", 4),
    ).toEqual({ dueDate: "2026-10-26" });
  });

  it("shifts only the start date of a start-only task", () => {
    expect(
      applyDragDelta(task("s", "2026-10-22", undefined), "move", -4),
    ).toEqual({ startDate: "2026-10-18" });
  });

  it("returns the entered dates unchanged for a zero delta", () => {
    expect(
      applyDragDelta(task("m", "2026-10-12", "2026-10-14"), "move", 0),
    ).toEqual({ startDate: "2026-10-12", dueDate: "2026-10-14" });
  });

  it("shifts across month and year boundaries", () => {
    expect(
      applyDragDelta(task("m", "2026-12-30", "2027-01-02"), "move", 3),
    ).toEqual({ startDate: "2027-01-02", dueDate: "2027-01-05" });
  });

  it("returns no dates for an undated task", () => {
    expect(applyDragDelta(task("u", undefined, undefined), "move", 5)).toEqual(
      {},
    );
  });
});

describe("applyDragDelta resize-start", () => {
  it("moves only the start date of a two-dated task", () => {
    expect(
      applyDragDelta(task("r", "2026-10-12", "2026-10-20"), "resize-start", 3),
    ).toEqual({ startDate: "2026-10-15" });
  });

  it("clamps the start at the due date, keeping a one-day bar", () => {
    expect(
      applyDragDelta(task("r", "2026-10-12", "2026-10-14"), "resize-start", 99),
    ).toEqual({ startDate: "2026-10-14" });
  });

  it("clamps a drag to the due date exactly on the last allowed day", () => {
    expect(
      applyDragDelta(task("r", "2026-10-12", "2026-10-14"), "resize-start", 2),
    ).toEqual({ startDate: "2026-10-14" });
  });

  it("extends the bar to the left for negative deltas", () => {
    expect(
      applyDragDelta(task("r", "2026-10-12", "2026-10-14"), "resize-start", -6),
    ).toEqual({ startDate: "2026-10-06" });
  });

  it("sets the missing start endpoint on a due-only bar", () => {
    expect(
      applyDragDelta(task("d", undefined, "2026-10-22"), "resize-start", -3),
    ).toEqual({ startDate: "2026-10-19" });
  });

  it("clamps the missing start endpoint of a due-only bar to the due date", () => {
    expect(
      applyDragDelta(task("d", undefined, "2026-10-22"), "resize-start", 4),
    ).toEqual({ startDate: "2026-10-22" });
  });

  it("shifts a start-only one-day bar like the left edge of its span", () => {
    expect(
      applyDragDelta(task("s", "2026-10-22", undefined), "resize-start", -3),
    ).toEqual({ startDate: "2026-10-19" });
  });

  it("pins a start-only one-day bar against rightward resize-start drags", () => {
    expect(
      applyDragDelta(task("s", "2026-10-22", undefined), "resize-start", 3),
    ).toEqual({ startDate: "2026-10-22" });
  });
});

describe("applyDragDelta resize-end", () => {
  it("moves only the due date of a two-dated task", () => {
    expect(
      applyDragDelta(task("r", "2026-10-12", "2026-10-20"), "resize-end", 3),
    ).toEqual({ dueDate: "2026-10-23" });
  });

  it("clamps the due at the start date, keeping a one-day bar", () => {
    expect(
      applyDragDelta(task("r", "2026-10-18", "2026-10-20"), "resize-end", -99),
    ).toEqual({ dueDate: "2026-10-18" });
  });

  it("clamps a drag to the start date exactly on the last allowed day", () => {
    expect(
      applyDragDelta(task("r", "2026-10-18", "2026-10-20"), "resize-end", -2),
    ).toEqual({ dueDate: "2026-10-18" });
  });

  it("extends the bar to the right for positive deltas", () => {
    expect(
      applyDragDelta(task("r", "2026-10-18", "2026-10-20"), "resize-end", 9),
    ).toEqual({ dueDate: "2026-10-29" });
  });

  it("sets the missing due endpoint on a start-only bar", () => {
    expect(
      applyDragDelta(task("s", "2026-10-22", undefined), "resize-end", 3),
    ).toEqual({ dueDate: "2026-10-25" });
  });

  it("clamps the missing due endpoint of a start-only bar to the start date", () => {
    expect(
      applyDragDelta(task("s", "2026-10-22", undefined), "resize-end", -4),
    ).toEqual({ dueDate: "2026-10-22" });
  });

  it("shifts a due-only one-day bar like the right edge of its span", () => {
    expect(
      applyDragDelta(task("d", undefined, "2026-10-22"), "resize-end", 5),
    ).toEqual({ dueDate: "2026-10-27" });
  });

  it("pins a due-only one-day bar against leftward resize-end drags", () => {
    expect(
      applyDragDelta(task("d", undefined, "2026-10-22"), "resize-end", -30),
    ).toEqual({ dueDate: "2026-10-22" });
  });
});

describe("applyDragDelta on a single-dated bar (resize creates the missing date)", () => {
  it("start-dated bar, resize-end drag: creates the due date at the dragged position", () => {
    expect(
      applyDragDelta(task("s", "2026-10-22", undefined), "resize-end", 4),
    ).toEqual({ dueDate: "2026-10-26" });
    expect(
      applyDragDelta(task("s", "2026-10-22", undefined), "resize-end", -2),
    ).toEqual({ dueDate: "2026-10-22" });
  });

  it("start-dated bar, resize-start drag: shifts the lone start date", () => {
    expect(
      applyDragDelta(task("s", "2026-10-22", undefined), "resize-start", -3),
    ).toEqual({ startDate: "2026-10-19" });
    expect(
      applyDragDelta(task("s", "2026-10-22", undefined), "resize-start", 3),
    ).toEqual({ startDate: "2026-10-22" });
  });

  it("due-dated bar, resize-start drag: creates the start date clamped to <= due date", () => {
    expect(
      applyDragDelta(task("d", undefined, "2026-10-22"), "resize-start", -3),
    ).toEqual({ startDate: "2026-10-19" });
    expect(
      applyDragDelta(task("d", undefined, "2026-10-22"), "resize-start", 4),
    ).toEqual({ startDate: "2026-10-22" });
  });

  it("due-dated bar, resize-end drag: shifts the lone due date", () => {
    expect(
      applyDragDelta(task("d", undefined, "2026-10-22"), "resize-end", 5),
    ).toEqual({ dueDate: "2026-10-27" });
    expect(
      applyDragDelta(task("d", undefined, "2026-10-22"), "resize-end", -3),
    ).toEqual({ dueDate: "2026-10-22" });
  });
});
