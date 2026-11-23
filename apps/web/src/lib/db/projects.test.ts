import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boardFiltersStorageKey } from "../storage/project-storage";
import type { NanoboardDB } from "./db";
import {
  createProject,
  deleteProject,
  getProject,
  getProjects,
  getProjectStats,
  reorderProjects,
  updateProject,
} from "./projects";
import { columnSlug, DEFAULT_COLUMNS, type DueDateString } from "./schema";
import {
  buildTestContents,
  createMemoryStorage,
  createTestDb,
  makeProject,
  makeTask,
  makeTaskResource,
  seedTestDb,
  TEST_NOW,
} from "./test-db";
import { getWhiteboard, saveWhiteboardScene } from "./whiteboards";

describe("deleteProject cascade", () => {
  let db: NanoboardDB;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestDb(db, buildTestContents());
  });

  afterEach(async () => {
    await db.close();
  });

  it("evicts all 11 project-owned tables including taskResources and clears per-project storage", async () => {
    const key1 = boardFiltersStorageKey("project-1");
    const key2 = boardFiltersStorageKey("project-2");
    const storage = createMemoryStorage({
      [key1]: JSON.stringify({ labels: ["label-1"] }),
      [key2]: JSON.stringify({ labels: ["label-2"] }),
      "nanoboard-theme": "dark",
    });

    await db.projects.add(
      makeProject({ id: "project-2", name: "Other", slug: "OT", position: 1 }),
    );
    await db.taskResources.add(
      makeTaskResource({
        id: "resource-other",
        taskId: "other-task",
        url: "https://example.com/keep",
      }),
    );

    await deleteProject(db, "project-1", { storage });

    expect(await db.projects.get("project-1")).toBeUndefined();
    expect(await db.projects.get("project-2")).toBeDefined();
    expect(
      await db.columns.where("projectId").equals("project-1").count(),
    ).toBe(0);
    expect(await db.tasks.where("projectId").equals("project-1").count()).toBe(
      0,
    );
    expect(await db.labels.where("projectId").equals("project-1").count()).toBe(
      0,
    );
    expect(await db.taskLabels.count()).toBe(0);
    // Project-1's task resource is evicted; unrelated resource survives.
    expect(await db.taskResources.get("resource-1")).toBeUndefined();
    expect(await db.taskResources.get("resource-other")).toBeDefined();
    expect(
      await db.whiteboards.where("projectId").equals("project-1").count(),
    ).toBe(0);
    expect(await db.whiteboardPreviews.get("project-1")).toBeUndefined();
    expect(await db.pages.where("projectId").equals("project-1").count()).toBe(
      0,
    );
    expect(
      await db.pageContents.where("projectId").equals("project-1").count(),
    ).toBe(0);
    expect(
      await db.pageAssets.where("projectId").equals("project-1").count(),
    ).toBe(0);
    // Global stickies are not project-owned and survive.
    expect(await db.stickies.count()).toBe(1);

    // Per-project board filters are cleared; other projects & global prefs survive.
    expect(storage.entries.has(key1)).toBe(false);
    expect(storage.entries.has(key2)).toBe(true);
    expect(storage.entries.get("nanoboard-theme")).toBe("dark");
  });

  it("isolates whiteboard row-identity cache per NanoboardDB instance", async () => {
    const otherDb = createTestDb();
    try {
      await seedTestDb(otherDb, buildTestContents());
      // Prime both databases' caches for the same projectId.
      const beforeA = await getWhiteboard(db, "project-1");
      const beforeB = await getWhiteboard(otherDb, "project-1");
      expect(beforeA?.id).toBe("whiteboard-1");
      expect(beforeB?.id).toBe("whiteboard-1");

      // Deleting project-1 in `db` must not disturb `otherDb`'s whiteboard cache.
      await deleteProject(db, "project-1", { storage: null });
      await saveWhiteboardScene(otherDb, "project-1", {
        elements: [],
        appState: {},
        files: {},
      });

      const afterB = await getWhiteboard(otherDb, "project-1");
      expect(afterB?.id).toBe("whiteboard-1");
      expect(afterB?.elements).toEqual([]);
    } finally {
      await otherDb.close();
    }
  });

  it("throws when deleting a missing project", async () => {
    await expect(
      deleteProject(db, "missing-project", { storage: null }),
    ).rejects.toThrow("Project not found.");
  });
});

describe("project CRUD, ordering, and stats", () => {
  let db: NanoboardDB;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  it("creates a project with default columns and auto-deduplicates suggested keys", async () => {
    const firstId = await createProject(db, { name: "Work Roadmap" });
    const secondId = await createProject(db, { name: "Work Roadmap" });

    const first = await getProject(db, firstId);
    const second = await getProject(db, secondId);
    expect(first?.slug).toBe("WR");
    expect(first?.position).toBe(0);
    expect(second?.slug).toBe("WR2");
    expect(second?.position).toBe(1);

    const columns = await db.columns
      .where("projectId")
      .equals(firstId)
      .sortBy("position");
    expect(columns.map((c) => c.slug)).toEqual(
      DEFAULT_COLUMNS.map((def) => def.slug),
    );
  });

  it("rejects duplicate explicit keys (case-insensitively), invalid names, and invalid icons", async () => {
    await createProject(db, { name: "Alpha", slug: "ALP" });

    await expect(
      createProject(db, { name: "Beta", slug: "alp" }),
    ).rejects.toThrow('A project with key "ALP" already exists.');
    await expect(createProject(db, { name: "   " })).rejects.toThrow();
    await expect(
      createProject(db, { name: "Bad Key", slug: "1ABC" }),
    ).rejects.toThrow();
    await expect(
      createProject(db, { name: "Bad Icon", icon: "NotAnIcon" }),
    ).rejects.toThrow();
  });

  it("updates fields, allows keeping its own key, and clears blank descriptions", async () => {
    const id = await createProject(db, { name: "Alpha", slug: "ALP" });
    await createProject(db, { name: "Beta", slug: "BET" });

    await updateProject(db, id, {
      name: "  Alpha Renamed  ",
      slug: "alp",
      description: "Core roadmap",
    });
    const updated = await getProject(db, id);
    expect(updated?.name).toBe("Alpha Renamed");
    expect(updated?.slug).toBe("ALP");
    expect(updated?.description).toBe("Core roadmap");

    await updateProject(db, id, { description: "   " });
    expect((await getProject(db, id))?.description).toBeUndefined();

    await expect(updateProject(db, id, { slug: "BET" })).rejects.toThrow(
      'A project with key "BET" already exists.',
    );
    await expect(updateProject(db, "missing", { name: "X" })).rejects.toThrow(
      "Project not found.",
    );
  });

  it("reorders projects densely and validates full unique coverage", async () => {
    const a = await createProject(db, { name: "A", slug: "A" });
    const b = await createProject(db, { name: "B", slug: "B" });
    const c = await createProject(db, { name: "C", slug: "C" });

    await reorderProjects(db, [c, a, b]);
    expect((await getProjects(db)).map((p) => p.id)).toEqual([c, a, b]);
    expect((await getProjects(db)).map((p) => p.position)).toEqual([0, 1, 2]);

    await expect(reorderProjects(db, [a, a, b])).rejects.toThrow(
      "Project IDs must be unique.",
    );
    await expect(reorderProjects(db, [a, b])).rejects.toThrow(
      "Reorder list must cover every project exactly once.",
    );
  });

  it("computes completion percentage and soonest due date from active tasks only", async () => {
    await seedTestDb(db, {
      ...buildTestContents(),
      tasks: [
        ...buildTestContents().tasks,
        makeTask({
          id: "task-done",
          columnId: "column-3",
          status: columnSlug("done"),
          number: 3,
          dueDate: "2026-01-15" as DueDateString,
        }),
        makeTask({
          id: "task-archived",
          columnId: "column-3",
          status: columnSlug("done"),
          number: 4,
          dueDate: "2026-01-01" as DueDateString,
          archivedAt: TEST_NOW,
        }),
      ],
    });

    const stats = await getProjectStats(db, "project-1");
    expect(stats).toEqual({
      totalTasks: 3,
      doneTasks: 1,
      completionPercentage: 33,
      dueDate: "2026-01-15",
    });

    expect(await getProjectStats(db, "empty-project")).toEqual({
      totalTasks: 0,
      doneTasks: 0,
      completionPercentage: 0,
      dueDate: null,
    });
  });
});
