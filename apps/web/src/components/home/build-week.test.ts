import { describe, expect, it } from "vitest";
import type { DueDateString } from "@/lib/db/schema";
import { buildWeek, type WeekStripTask } from "./build-week";

const now = new Date(2026, 9, 2, 15, 0);

function task(id: string, dueDate: string | null): WeekStripTask {
  return {
    id,
    projectId: "project-1",
    projectSlug: "TP",
    number: 1,
    title: id,
    dueDate: (dueDate ?? undefined) as DueDateString | undefined,
  };
}

describe("buildWeek", () => {
  it("spans three days either side of today", () => {
    const week = buildWeek([], now);

    expect(week).toHaveLength(7);
    expect(week.map((day) => day.date.getDate())).toEqual([
      29, 30, 1, 2, 3, 4, 5,
    ]);
    expect(week.map((day) => day.isToday)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(week.filter((day) => day.isPast)).toHaveLength(3);
  });

  it("places tasks on the day they are due and skips the rest", () => {
    const week = buildWeek(
      [
        task("late", "2026-09-30"),
        task("today", "2026-10-02"),
        task("far", "2026-10-26"),
        task("undated", null),
      ],
      now,
    );

    expect(week[1].tasks.map((item) => item.id)).toEqual(["late"]);
    expect(week[3].tasks.map((item) => item.id)).toEqual(["today"]);
    expect(week.flatMap((day) => day.tasks)).toHaveLength(2);
  });

  it("buckets by due date only, never by start date", () => {
    const spanning = {
      ...task("spanning", "2026-10-20"),
      startDate: "2026-10-02",
    } as WeekStripTask;

    const week = buildWeek([spanning], now);

    expect(week.flatMap((day) => day.tasks)).toHaveLength(0);
  });

  it("hides tasks due more than three days ago", () => {
    const week = buildWeek([task("very-late", "2026-09-28")], now);

    expect(week.flatMap((day) => day.tasks)).toHaveLength(0);
  });
});
