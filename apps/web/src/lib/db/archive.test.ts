import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveCompletedTasks,
  archiveTask,
  getArchivedProjectTasks,
  restoreTask,
} from "./archive";
import { countProjectTasks, getProjectTasks } from "./tasks";
import { getProjectTaskLabels } from "./labels";
import { getProjectStats, getProjectsStats } from "./projects";
import { readProjectTransferSource } from "./transfer";
import { NanoboardDB } from "./db";
import {
  buildTestContents,
  createTestDb,
  makeTask,
  seedTestDb,
  TEST_NOW,
  type TestDbContents,
} from "./test-db";
import { columnSlug } from "./schema";

/**
 * The representative workspace plus two tasks sitting in the final column
 * (column-3, "Completed"), one carrying a label assignment so exclusion
 * tests can observe the join.
 */
function buildArchiveContents(): TestDbContents {
  const base = buildTestContents();
  return {
    ...base,
    tasks: [
      ...base.tasks,
      makeTask({
        id: "task-3",
        columnId: "column-3",
        status: columnSlug("done"),
        title: "Ship the release",
        number: 3,
        position: 0,
      }),
      makeTask({
        id: "task-4",
        columnId: "column-3",
        status: columnSlug("done"),
        title: "Write the changelog",
        number: 4,
        position: 1,
      }),
    ],
    taskLabels: [
      ...base.taskLabels,
      { taskId: "task-3", labelId: "label-docs" },
    ],
  };
}

describe("archive data layer", () => {
  let db: NanoboardDB;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestDb(db, buildArchiveContents());
  });

  afterEach(async () => {
    vi.useRealTimers();
    await db.close();
  });

  describe("archiveTask", () => {
    it("stamps archivedAt and updatedAt on a final-column task, touching nothing else", async () => {
      const before = await db.tasks.get("task-3");
      expect(before).toBeDefined();

      const now = 1_800_000_000_000;
      // Fake only the clock: fake-indexeddb still needs real timers to run
      // its transaction queue.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(now);

      await archiveTask(db, "task-3");

      const after = await db.tasks.get("task-3");
      expect(after?.archivedAt).toBe(now);
      expect(after?.updatedAt).toBe(now);
      // Everything except archivedAt/updatedAt is byte-identical; toEqual
      // ignores the absent-vs-undefined distinction for archivedAt.
      expect({ ...after, archivedAt: undefined, updatedAt: TEST_NOW }).toEqual(
        before,
      );
    });

    it("throws for a task in a non-final column and mutates nothing", async () => {
      const before = await db.tasks.get("task-1");

      await expect(archiveTask(db, "task-1")).rejects.toThrow(
        /completed column/,
      );
      expect(await db.tasks.get("task-1")).toEqual(before);
    });

    it("throws for a missing task", async () => {
      await expect(archiveTask(db, "task-nope")).rejects.toThrow(
        "Task not found.",
      );
    });
  });

  describe("restoreTask", () => {
    it("clears archivedAt, bumps updatedAt, and round-trips the row", async () => {
      const snapshot = await db.tasks.get("task-3");

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(1_800_000_000_000);
      await archiveTask(db, "task-3");
      vi.setSystemTime(1_900_000_000_000);
      await restoreTask(db, "task-3");

      const restored = await db.tasks.get("task-3");
      expect(restored?.archivedAt).toBeUndefined();
      expect(restored?.updatedAt).toBe(1_900_000_000_000);
      // Byte-identical to the pre-archive row apart from updatedAt.
      expect({ ...restored, updatedAt: TEST_NOW }).toEqual(snapshot);
    });

    it("is a no-op for a task that is not archived", async () => {
      const before = await db.tasks.get("task-1");

      await restoreTask(db, "task-1");

      expect(await db.tasks.get("task-1")).toEqual(before);
    });

    it("throws for a missing task", async () => {
      await expect(restoreTask(db, "task-nope")).rejects.toThrow(
        "Task not found.",
      );
    });
  });

  describe("getArchivedProjectTasks", () => {
    it("lists archived tasks only, newest archive first", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(1_800_000_000_000);
      await archiveTask(db, "task-3");
      vi.setSystemTime(1_850_000_000_000);
      await archiveTask(db, "task-4");

      const archived = await getArchivedProjectTasks(db, "project-1");

      expect(archived.map((task) => task.id)).toEqual(["task-4", "task-3"]);
    });

    it("is empty before anything is archived", async () => {
      expect(await getArchivedProjectTasks(db, "project-1")).toEqual([]);
    });
  });

  describe("archiveCompletedTasks", () => {
    it("archives exactly the non-archived final-column tasks and returns the count", async () => {
      // Seeded board: task-1 in backlog, task-2 in progress, task-3/task-4
      // in the final column. Only the last two are archivable.
      const count = await archiveCompletedTasks(db, "project-1");

      expect(count).toBe(2);
      expect((await db.tasks.get("task-3"))?.archivedAt).toBeTypeOf("number");
      expect((await db.tasks.get("task-4"))?.archivedAt).toBeTypeOf("number");
      expect((await db.tasks.get("task-1"))?.archivedAt).toBeUndefined();
      expect((await db.tasks.get("task-2"))?.archivedAt).toBeUndefined();
    });

    it("skips already-archived tasks and no-ops at zero", async () => {
      await archiveCompletedTasks(db, "project-1");
      const stamped = (await db.tasks.get("task-3"))?.archivedAt;

      const secondPass = await archiveCompletedTasks(db, "project-1");

      expect(secondPass).toBe(0);
      // The first sweep's stamp is left alone.
      // The first sweep's stamp is left alone.
      expect((await db.tasks.get("task-3"))?.archivedAt).toBe(stamped);
    });
  });

  describe("active reads exclude archived rows", () => {
    beforeEach(async () => {
      await archiveTask(db, "task-3");
      await archiveTask(db, "task-4");
    });

    it("getProjectTasks lists active tasks only; includeArchived overrides", async () => {
      const active = await getProjectTasks(db, "project-1");
      expect(active.map((task) => task.id)).toEqual(["task-1", "task-2"]);

      const inclusive = await getProjectTasks(db, "project-1", {
        includeArchived: true,
      });
      expect(inclusive.map((task) => task.id).sort()).toEqual([
        "task-1",
        "task-2",
        "task-3",
        "task-4",
      ]);
    });

    it("countProjectTasks counts active tasks only", async () => {
      expect(await countProjectTasks(db, "project-1")).toBe(2);
    });

    it("getProjectTaskLabels joins off active tasks only; includeArchived overrides", async () => {
      const active = await getProjectTaskLabels(db, "project-1");
      expect([...active.keys()]).toEqual(["task-1"]);

      const inclusive = await getProjectTaskLabels(db, "project-1", {
        includeArchived: true,
      });
      expect([...inclusive.keys()].sort()).toEqual(["task-1", "task-3"]);
    });

    it("getProjectsStats excludes archived rows", async () => {
      const stats = await getProjectsStats(db);
      const project = stats.get("project-1");
      // 4 seeded tasks, 2 archived: only backlog + in-progress remain, no
      // final-column work left to count as done.
      expect(project?.totalTasks).toBe(2);
      expect(project?.doneTasks).toBe(0);
      expect(project?.completionPercentage).toBe(0);
    });

    it("getProjectStats falls through to the zero stats for a fully-archived project", async () => {
      // Only final-column tasks, so the sweep can archive the whole board.
      const contents = buildArchiveContents();
      await seedTestDb(db, {
        ...contents,
        tasks: contents.tasks.filter((task) => task.columnId === "column-3"),
        taskLabels: contents.taskLabels.filter((join) =>
          ["task-3", "task-4"].includes(join.taskId),
        ),
      });
      expect(await archiveCompletedTasks(db, "project-1")).toBe(2);

      const stats = await getProjectStats(db, "project-1");
      expect(stats).toEqual({
        totalTasks: 0,
        doneTasks: 0,
        completionPercentage: 0,
        dueDate: null,
      });
    });
  });

  describe("transfer source", () => {
    it("stays inclusive of archived rows and their label joins", async () => {
      await archiveTask(db, "task-3");

      const source = await readProjectTransferSource(db, "project-1");

      expect(source.tasks.map((task) => task.id).sort()).toEqual([
        "task-1",
        "task-2",
        "task-3",
        "task-4",
      ]);
      expect(source.labelsByTask.get("task-3")?.[0]?.id).toBe("label-docs");
    });
  });
});
