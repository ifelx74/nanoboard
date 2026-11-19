import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getOpenTasks, shiftTaskDates } from "./tasks";
import { NanoboardDB } from "./db";
import {
  buildTestContents,
  createTestDb,
  makeColumn,
  makeProject,
  makeTask,
  seedTestDb,
  TEST_NOW,
  type TestDbContents,
} from "./test-db";
import { columnSlug, startDate, type DueDateString } from "./schema";

function buildOpenTasksContents(): TestDbContents {
  const base = buildTestContents();
  return {
    ...base,
    projects: [
      ...base.projects,
      makeProject({ id: "project-2", name: "Second project", slug: "SP" }),
    ],
    columns: [
      ...base.columns,
      makeColumn({
        id: "column-4",
        projectId: "project-2",
        name: "Backlog",
        slug: columnSlug("backlog"),
        position: 0,
      }),
    ],
    tasks: [
      ...base.tasks,
      makeTask({
        id: "task-3",
        columnId: "column-3",
        status: columnSlug("done"),
        title: "Finished task",
        number: 3,
        dueDate: "2026-01-31" as DueDateString,
      }),
      makeTask({
        id: "task-4",
        title: "Filed task",
        number: 4,
        dueDate: "2026-01-31" as DueDateString,
        archivedAt: TEST_NOW,
      }),
      makeTask({
        id: "task-5",
        projectId: "project-2",
        columnId: "column-4",
        title: "Other project task",
        number: 1,
        dueDate: "2026-01-30" as DueDateString,
      }),
      makeTask({
        id: "task-6",
        title: "Far future task",
        number: 5,
        dueDate: "2026-03-31" as DueDateString,
      }),
    ],
  };
}

describe("getOpenTasks", () => {
  let db: NanoboardDB;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestDb(db, buildOpenTasksContents());
  });

  afterEach(async () => {
    await db.close();
  });

  it("returns open tasks due in the window across all projects, with slugs", async () => {
    const tasks = await getOpenTasks(
      db,
      "2026-01-28" as DueDateString,
      "2026-01-31" as DueDateString,
    );

    expect(tasks.map((task) => task.id).sort()).toEqual(["task-2", "task-5"]);
    expect(tasks.find((task) => task.id === "task-2")?.projectSlug).toBe("TP");
    expect(tasks.find((task) => task.id === "task-5")?.projectSlug).toBe("SP");
  });

  it("excludes tasks in final columns and archived tasks", async () => {
    const ids = (
      await getOpenTasks(
        db,
        "2026-01-28" as DueDateString,
        "2026-01-31" as DueDateString,
      )
    ).map((task) => task.id);

    expect(ids).not.toContain("task-3");
    expect(ids).not.toContain("task-4");
  });

  it("keeps tasks due outside the window out of the result", async () => {
    const ids = (
      await getOpenTasks(
        db,
        "2026-01-28" as DueDateString,
        "2026-01-31" as DueDateString,
      )
    ).map((task) => task.id);

    expect(ids).not.toContain("task-6");
  });
});

function buildShiftContents(): TestDbContents {
  const base = buildTestContents();
  return {
    ...base,
    tasks: [
      ...base.tasks,
      makeTask({
        id: "task-start-only",
        title: "Start only",
        number: 3,
        startDate: startDate("2026-01-10"),
      }),
      makeTask({
        id: "task-inverted",
        title: "Inverted range",
        number: 4,
        startDate: startDate("2026-02-10"),
        dueDate: "2026-02-01" as DueDateString,
      }),
    ],
  };
}

describe("shiftTaskDates", () => {
  let db: NanoboardDB;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestDb(db, buildShiftContents());
  });

  afterEach(async () => {
    await db.close();
  });

  it("shifts both dates together, preserving the duration", async () => {
    await shiftTaskDates(db, "task-2", 5);

    const shifted = await db.tasks.get("task-2");
    expect(shifted?.startDate).toBe("2026-01-07");
    expect(shifted?.dueDate).toBe("2026-02-05");
  });

  it("shifts the due date backwards across month boundaries", async () => {
    await shiftTaskDates(db, "task-2", -12);

    const shifted = await db.tasks.get("task-2");
    expect(shifted?.startDate).toBe("2025-12-21");
    expect(shifted?.dueDate).toBe("2026-01-19");
  });

  it("shifts only the due date of a due-only task", async () => {
    await seedTestDb(db, {
      ...buildShiftContents(),
      tasks: [
        makeTask({
          id: "task-due-only",
          title: "Due only",
          number: 5,
          dueDate: "2026-01-31" as DueDateString,
        }),
      ],
    });

    await shiftTaskDates(db, "task-due-only", 7);

    const shifted = await db.tasks.get("task-due-only");
    expect(shifted?.startDate).toBeUndefined();
    expect(shifted?.dueDate).toBe("2026-02-07");
  });

  it("shifts only the start date of a start-only task", async () => {
    await shiftTaskDates(db, "task-start-only", -4);

    const shifted = await db.tasks.get("task-start-only");
    expect(shifted?.startDate).toBe("2026-01-06");
    expect(shifted?.dueDate).toBeUndefined();
  });

  it("leaves an undated task untouched", async () => {
    await shiftTaskDates(db, "task-1", 9);

    const shifted = await db.tasks.get("task-1");
    expect(shifted?.startDate).toBeUndefined();
    expect(shifted?.dueDate).toBeUndefined();
    expect(shifted?.updatedAt).toBe(TEST_NOW);
  });

  it("treats a zero delta as a no-op write", async () => {
    await shiftTaskDates(db, "task-2", 0);

    const shifted = await db.tasks.get("task-2");
    expect(shifted?.startDate).toBe("2026-01-02");
    expect(shifted?.dueDate).toBe("2026-01-31");
    expect(shifted?.updatedAt).toBe(TEST_NOW);
  });

  it("bumps updatedAt once and leaves createdAt alone", async () => {
    const before = await db.tasks.get("task-2");
    await shiftTaskDates(db, "task-2", 1);

    const shifted = await db.tasks.get("task-2");
    expect(shifted?.updatedAt).toBeGreaterThan(before?.updatedAt ?? 0);
    expect(shifted?.createdAt).toBe(before?.createdAt);
  });

  it("rejects a non-integer delta and writes nothing", async () => {
    await expect(shiftTaskDates(db, "task-2", 1.5)).rejects.toThrow();

    const after = await db.tasks.get("task-2");
    expect(after?.startDate).toBe("2026-01-02");
    expect(after?.dueDate).toBe("2026-01-31");
    expect(after?.updatedAt).toBe(TEST_NOW);
  });

  it("rejects a shift that would invert the range, writing nothing", async () => {
    await expect(shiftTaskDates(db, "task-inverted", 30)).rejects.toThrow(
      "Start date cannot be after due date.",
    );

    const after = await db.tasks.get("task-inverted");
    expect(after?.startDate).toBe("2026-02-10");
    expect(after?.dueDate).toBe("2026-02-01");
    expect(after?.updatedAt).toBe(TEST_NOW);
  });

  it("throws for a missing task", async () => {
    await expect(shiftTaskDates(db, "nope", 1)).rejects.toThrow(
      "Task not found.",
    );
  });
});
