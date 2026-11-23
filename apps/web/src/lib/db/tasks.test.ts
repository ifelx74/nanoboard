import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTask,
  deleteTask,
  duplicateTask,
  getOpenTasks,
  getTask,
  moveTaskToColumn,
  reorderTasks,
  rescheduleTask,
  updateTaskDescription,
  updateTaskDueDate,
  updateTaskPriority,
  updateTaskStartDate,
  updateTaskTitle,
} from "./tasks";
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

describe("rescheduleTask", () => {
  let db: NanoboardDB;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestDb(db, buildShiftContents());
  });

  afterEach(async () => {
    await db.close();
  });

  it("move: shifts both dates together, preserving duration", async () => {
    await rescheduleTask(db, "task-2", "move", 5);

    const shifted = await db.tasks.get("task-2");
    expect(shifted?.startDate).toBe("2026-01-07");
    expect(shifted?.dueDate).toBe("2026-02-05");
  });

  it("move: shifts backwards across month and year boundaries", async () => {
    await rescheduleTask(db, "task-2", "move", -12);

    const shifted = await db.tasks.get("task-2");
    expect(shifted?.startDate).toBe("2025-12-21");
    expect(shifted?.dueDate).toBe("2026-01-19");
  });

  it("move: shifts only the due date of a due-only task", async () => {
    await db.tasks.add(
      makeTask({
        id: "task-due-only",
        title: "Due only",
        number: 5,
        dueDate: "2026-01-31" as DueDateString,
      }),
    );

    await rescheduleTask(db, "task-due-only", "move", 7);

    const shifted = await db.tasks.get("task-due-only");
    expect(shifted?.startDate).toBeUndefined();
    expect(shifted?.dueDate).toBe("2026-02-07");
  });

  it("move: shifts only the start date of a start-only task", async () => {
    await rescheduleTask(db, "task-start-only", "move", -4);

    const shifted = await db.tasks.get("task-start-only");
    expect(shifted?.startDate).toBe("2026-01-06");
    expect(shifted?.dueDate).toBeUndefined();
  });

  it("resize-start: moves start on a two-dated task and clamps at due date (min 1-day bar)", async () => {
    await rescheduleTask(db, "task-2", "resize-start", 3);
    expect((await db.tasks.get("task-2"))?.startDate).toBe("2026-01-05");
    expect((await db.tasks.get("task-2"))?.dueDate).toBe("2026-01-31");

    await rescheduleTask(db, "task-2", "resize-start", 99);
    expect((await db.tasks.get("task-2"))?.startDate).toBe("2026-01-31");
    expect((await db.tasks.get("task-2"))?.dueDate).toBe("2026-01-31");
  });

  it("resize-start: sets missing start endpoint on a due-only bar, clamped to <= due", async () => {
    await db.tasks.add(
      makeTask({
        id: "task-due-a",
        title: "Due A",
        number: 5,
        dueDate: "2026-10-22" as DueDateString,
      }),
    );
    await db.tasks.add(
      makeTask({
        id: "task-due-b",
        title: "Due B",
        number: 6,
        dueDate: "2026-10-22" as DueDateString,
      }),
    );

    await rescheduleTask(db, "task-due-a", "resize-start", -3);
    expect((await db.tasks.get("task-due-a"))?.startDate).toBe("2026-10-19");
    expect((await db.tasks.get("task-due-a"))?.dueDate).toBe("2026-10-22");

    await rescheduleTask(db, "task-due-b", "resize-start", 4);
    expect((await db.tasks.get("task-due-b"))?.startDate).toBe("2026-10-22");
    expect((await db.tasks.get("task-due-b"))?.dueDate).toBe("2026-10-22");
  });

  it("resize-start: shifts start-only bar left and pins rightward drags as a no-op", async () => {
    await rescheduleTask(db, "task-start-only", "resize-start", 3);
    expect((await db.tasks.get("task-start-only"))?.startDate).toBe(
      "2026-01-10",
    );
    expect((await db.tasks.get("task-start-only"))?.updatedAt).toBe(TEST_NOW);

    await rescheduleTask(db, "task-start-only", "resize-start", -3);
    expect((await db.tasks.get("task-start-only"))?.startDate).toBe(
      "2026-01-07",
    );
    expect((await db.tasks.get("task-start-only"))?.dueDate).toBeUndefined();
  });

  it("resize-end: moves due on a two-dated task and clamps at start date (min 1-day bar)", async () => {
    await rescheduleTask(db, "task-2", "resize-end", 5);
    expect((await db.tasks.get("task-2"))?.dueDate).toBe("2026-02-05");

    await rescheduleTask(db, "task-2", "resize-end", -99);
    expect((await db.tasks.get("task-2"))?.startDate).toBe("2026-01-02");
    expect((await db.tasks.get("task-2"))?.dueDate).toBe("2026-01-02");
  });

  it("resize-end: sets missing due endpoint on a start-only bar, clamped to >= start", async () => {
    await db.tasks.add(
      makeTask({
        id: "task-start-b",
        title: "Start B",
        number: 5,
        startDate: startDate("2026-10-22"),
      }),
    );

    await rescheduleTask(db, "task-start-only", "resize-end", 4);
    expect((await db.tasks.get("task-start-only"))?.dueDate).toBe("2026-01-14");

    await rescheduleTask(db, "task-start-b", "resize-end", -2);
    expect((await db.tasks.get("task-start-b"))?.dueDate).toBe("2026-10-22");
  });

  it("resize-end: shifts due-only bar right and pins leftward drags as a no-op", async () => {
    await db.tasks.add(
      makeTask({
        id: "task-due-only",
        title: "Due only",
        number: 5,
        dueDate: "2026-10-22" as DueDateString,
      }),
    );

    await rescheduleTask(db, "task-due-only", "resize-end", -10);
    expect((await db.tasks.get("task-due-only"))?.dueDate).toBe("2026-10-22");
    expect((await db.tasks.get("task-due-only"))?.updatedAt).toBe(TEST_NOW);

    await rescheduleTask(db, "task-due-only", "resize-end", 5);
    expect((await db.tasks.get("task-due-only"))?.dueDate).toBe("2026-10-27");
    expect((await db.tasks.get("task-due-only"))?.startDate).toBeUndefined();
  });

  it("leaves an undated task and zero delta untouched", async () => {
    await rescheduleTask(db, "task-1", "move", 9);
    await rescheduleTask(db, "task-1", "resize-start", -3);
    await rescheduleTask(db, "task-2", "move", 0);

    expect((await db.tasks.get("task-1"))?.updatedAt).toBe(TEST_NOW);
    expect((await db.tasks.get("task-2"))?.updatedAt).toBe(TEST_NOW);
  });

  it("bumps updatedAt once and leaves createdAt alone", async () => {
    const before = await db.tasks.get("task-2");
    await rescheduleTask(db, "task-2", "move", 1);

    const shifted = await db.tasks.get("task-2");
    expect(shifted?.updatedAt).toBeGreaterThan(before?.updatedAt ?? 0);
    expect(shifted?.createdAt).toBe(before?.createdAt);
  });

  it("rejects a non-integer delta, an inverted range, or a missing task", async () => {
    await expect(rescheduleTask(db, "task-2", "move", 1.5)).rejects.toThrow();
    await expect(
      rescheduleTask(db, "task-inverted", "move", 30),
    ).rejects.toThrow("Start date cannot be after due date.");
    await expect(
      rescheduleTask(db, "task-inverted", "resize-start", -1),
    ).rejects.toThrow("Start date cannot be after due date.");
    await expect(rescheduleTask(db, "nope", "move", 1)).rejects.toThrow(
      "Task not found.",
    );

    expect((await db.tasks.get("task-2"))?.updatedAt).toBe(TEST_NOW);
    expect((await db.tasks.get("task-inverted"))?.updatedAt).toBe(TEST_NOW);
  });
});

describe("updateTaskStartDate & updateTaskDueDate", () => {
  let db: NanoboardDB;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestDb(db, buildShiftContents());
  });

  afterEach(async () => {
    await db.close();
  });

  it("sets and clears start/due dates while enforcing start <= due", async () => {
    await updateTaskStartDate(db, "task-2", startDate("2026-01-10"));
    expect((await db.tasks.get("task-2"))?.startDate).toBe("2026-01-10");

    await expect(
      updateTaskStartDate(db, "task-2", startDate("2026-02-01")),
    ).rejects.toThrow("Start date cannot be after due date.");

    await expect(
      updateTaskDueDate(db, "task-2", "2026-01-05" as DueDateString),
    ).rejects.toThrow("Start date cannot be after due date.");

    await updateTaskStartDate(db, "task-2", null);
    await updateTaskDueDate(db, "task-2", null);
    const cleared = await db.tasks.get("task-2");
    expect(cleared?.startDate).toBeUndefined();
    expect(cleared?.dueDate).toBeUndefined();
  });
});

describe("task CRUD, moving, reordering, duplicating, and deleting", () => {
  let db: NanoboardDB;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestDb(db, buildTestContents());
  });

  afterEach(async () => {
    await db.close();
  });

  it("creates a task with sequential number, next column position, and same-project labels", async () => {
    const id = await createTask(db, {
      projectId: "project-1",
      columnId: "column-1",
      title: "  Write docs  ",
      priority: "high",
      startDate: startDate("2026-02-01"),
      dueDate: "2026-02-05" as DueDateString,
      labelIds: ["label-bug", "label-bug"],
    });

    const created = await getTask(db, id);
    expect(created).toMatchObject({
      title: "Write docs",
      status: "backlog",
      number: 3,
      position: 1,
      priority: "high",
      startDate: "2026-02-01",
      dueDate: "2026-02-05",
    });
    expect((await db.projects.get("project-1"))?.lastTaskNumber).toBe(3);
    expect(
      (await db.taskLabels.where("taskId").equals(id).toArray()).map(
        (j) => j.labelId,
      ),
    ).toEqual(["label-bug"]);
  });

  it("rejects invalid title, inverted dates, or cross-project label on createTask", async () => {
    await db.projects.add(
      makeProject({ id: "project-2", name: "Other", slug: "OT", position: 1 }),
    );
    await db.labels.add({
      id: "other-label",
      projectId: "project-2",
      name: "foreign",
      color: "red",
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    });

    await expect(
      createTask(db, {
        projectId: "project-1",
        columnId: "column-1",
        title: "ab",
      }),
    ).rejects.toThrow();
    await expect(
      createTask(db, {
        projectId: "project-1",
        columnId: "column-1",
        title: "Inverted",
        startDate: startDate("2026-02-10"),
        dueDate: "2026-02-01" as DueDateString,
      }),
    ).rejects.toThrow("Start date cannot be after due date.");
    await expect(
      createTask(db, {
        projectId: "project-1",
        columnId: "column-1",
        title: "Foreign label",
        labelIds: ["other-label"],
      }),
    ).rejects.toThrow("Label and task must belong to the same project.");
  });

  it("updates title, description, and priority while skipping unchanged title writes", async () => {
    await updateTaskTitle(db, "task-1", "  Test task  ");
    expect((await getTask(db, "task-1"))?.updatedAt).toBe(TEST_NOW);

    await updateTaskTitle(db, "task-1", "Renamed task");
    await updateTaskDescription(db, "task-1", "Updated body");
    await updateTaskPriority(db, "task-1", "urgent");

    expect(await getTask(db, "task-1")).toMatchObject({
      title: "Renamed task",
      description: "Updated body",
      priority: "urgent",
    });
  });

  it("moves a task to another column by slug, syncing status and appending position", async () => {
    await moveTaskToColumn(db, "task-1", columnSlug("in-progress"));
    expect(await getTask(db, "task-1")).toMatchObject({
      columnId: "column-2",
      status: "in-progress",
      position: 1,
    });

    await expect(
      moveTaskToColumn(db, "task-1", columnSlug("nonexistent")),
    ).rejects.toThrow('Unknown column "nonexistent" in this project.');
  });

  it("reorders tasks atomically across columns and validates membership", async () => {
    await reorderTasks(db, "project-1", [
      { id: "task-2", position: 0, status: columnSlug("backlog") },
      { id: "task-1", position: 1 },
    ]);

    expect(await getTask(db, "task-2")).toMatchObject({
      columnId: "column-1",
      status: "backlog",
      position: 0,
    });
    expect((await getTask(db, "task-1"))?.position).toBe(1);

    await expect(
      reorderTasks(db, "project-1", [
        { id: "task-1", position: 0 },
        { id: "task-1", position: 1 },
      ]),
    ).rejects.toThrow("Task IDs must be unique.");
    await expect(
      reorderTasks(db, "project-1", [{ id: "task-1", position: -1 }]),
    ).rejects.toThrow("Positions must be integers at or above 0.");
  });

  it("duplicates a task in place with a fresh number and deletes a task with its joins and resources", async () => {
    const copyId = await duplicateTask(db, "task-2", "Copy of task 2");
    expect(await getTask(db, copyId)).toMatchObject({
      title: "Copy of task 2",
      columnId: "column-2",
      status: "in-progress",
      number: 3,
      position: 1,
      priority: "high",
      startDate: "2026-01-02",
      dueDate: "2026-01-31",
    });

    await deleteTask(db, "task-1");
    expect(await getTask(db, "task-1")).toBeUndefined();
    expect(await db.taskLabels.where("taskId").equals("task-1").count()).toBe(
      0,
    );
    expect(
      await db.taskResources.where("taskId").equals("task-1").count(),
    ).toBe(0);
    // Project task counter never rewinds.
    expect((await db.projects.get("project-1"))?.lastTaskNumber).toBe(3);
  });
});
