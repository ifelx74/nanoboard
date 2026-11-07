import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getOpenTasks } from "./tasks";
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
import { columnSlug, type DueDateString } from "./schema";

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
