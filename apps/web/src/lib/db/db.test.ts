import { describe, expect, it } from "vitest";
import { NanoboardDB } from "./db";
import {
  createTestDb,
  makeTask,
  makeWhiteboardPreview,
  seedTestDb,
  TEST_NOW,
} from "./test-db";

describe("NanoboardDB on fake-indexeddb", () => {
  it("opens the real schema on a fresh database and runs the populate seeding", async () => {
    const db = createTestDb();

    expect(db).toBeInstanceOf(NanoboardDB);

    await db.open();

    // Seed content from seed.ts: 2 projects x 5 columns, 9 tasks, the
    // default label palette (4 labels for the website project, 3 for the
    // mobile one) and 6 task assignments.
    expect(await db.projects.count()).toBe(2);
    expect(await db.columns.count()).toBe(10);
    expect(await db.tasks.count()).toBe(9);
    expect(await db.labels.count()).toBe(7);
    expect(await db.taskLabels.count()).toBe(6);

    // The untouched tables exist with the right schema and start empty —
    // including the v7 preview store, whose rows exist only alongside
    // content-ful scene saves.
    expect(await db.taskResources.count()).toBe(0);
    expect(await db.stickies.count()).toBe(0);
    expect(await db.whiteboards.count()).toBe(0);
    expect(await db.whiteboardPreviews.count()).toBe(0);

    await db.close();
  });

  it("round-trips representative rows through all nine tables", async () => {
    const db = createTestDb();

    await seedTestDb(db);

    // Counts are exactly what the representative contents hold — proving
    // seedTestDb replaces the fresh-boot seed content rather than appending
    // to it.
    expect(await db.projects.count()).toBe(1);
    expect(await db.columns.count()).toBe(3);
    expect(await db.tasks.count()).toBe(2);
    expect(await db.labels.count()).toBe(2);
    expect(await db.taskLabels.count()).toBe(1);
    expect(await db.taskResources.count()).toBe(1);
    expect(await db.stickies.count()).toBe(1);
    expect(await db.whiteboards.count()).toBe(1);
    expect(await db.whiteboardPreviews.count()).toBe(1);

    // Tasks: per-project numbering, dates, and the status mirror of the
    // parent column's slug.
    const task = await db.tasks.get("task-2");
    expect(task?.title).toBe("Wire up the label picker");
    expect(task?.number).toBe(2);
    expect(task?.status).toBe("in-progress");
    expect(task?.priority).toBe("high");
    expect(task?.startDate).toBe("2026-01-02");
    expect(task?.dueDate).toBe("2026-01-31");

    // The join table is keyed on the [taskId, labelId] compound primary key.
    expect(await db.taskLabels.get(["task-1", "label-bug"])).toEqual({
      taskId: "task-1",
      labelId: "label-bug",
    });

    // Manual URL link row.
    const resource = await db.taskResources.get("resource-1");
    expect(resource?.url).toBe("https://example.com/guide");
    expect(resource?.resourceType).toBe("url");
    expect(resource?.title).toBe("Guide");

    // Sticky note.
    const sticky = await db.stickies.get("sticky-1");
    expect(sticky?.backgroundColor).toBe("peach");
    expect(sticky?.contentHtml).toBe("<p>Remember the milk</p>");

    // Whiteboard: the Excalidraw scene triple survives a write/read cycle,
    // including the data-URL image file.
    const whiteboard = await db.whiteboards.get("whiteboard-1");
    expect(whiteboard?.projectId).toBe("project-1");
    expect(whiteboard?.elements[0]?.type).toBe("rectangle");
    expect(whiteboard?.appState.viewBackgroundColor).toBe("#fefefe");
    expect(whiteboard?.files["file-1"]?.dataURL).toMatch(
      /^data:image\/png;base64,/,
    );

    // Preview: keyed by projectId (the primary key itself), holding the
    // thumbnail data URL and the freshness stamp.
    const preview = await db.whiteboardPreviews.get("project-1");
    expect(preview?.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(preview?.updatedAt).toBe(TEST_NOW);

    await db.close();
  });

  it("keeps databases isolated from each other", async () => {
    const dbA = createTestDb();
    const dbB = createTestDb();

    expect(dbA.name).not.toBe(dbB.name);

    await seedTestDb(dbA);

    // A holds the representative project; B, untouched, is its own store —
    // it neither sees A's rows nor shares its name.
    expect(await dbA.projects.get("project-1")).toBeDefined();
    expect(await dbB.projects.get("project-1")).toBeUndefined();

    await dbA.close();
    await dbB.close();
  });

  it("enforces the declared schema's store-level constraints", async () => {
    const db = createTestDb();

    await seedTestDb(db);

    // v2 schema: per-project task numbers are store-enforced unique
    // (&[projectId+number]), so a second task with number 1 in the same
    // project is rejected at the store level.
    const duplicate = makeTask({ id: "task-duplicate", number: 1 });
    await expect(db.tasks.add(duplicate)).rejects.toThrow();

    // v7 schema: the preview store's primary key is projectId itself, so a
    // second preview row for the same project is rejected at the store
    // level — one preview row per project, like the scene row.
    const duplicatePreview = makeWhiteboardPreview({ projectId: "project-1" });
    await expect(db.whiteboardPreviews.add(duplicatePreview)).rejects.toThrow();

    await db.close();
  });
});
