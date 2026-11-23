import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NanoboardDB } from "./db";
import {
  attachLabel,
  createLabel,
  deleteLabel,
  detachLabel,
  getProjectLabels,
  getProjectTaskLabels,
  getTaskLabels,
  renameLabel,
  updateLabelColor,
} from "./labels";
import {
  buildTestContents,
  createTestDb,
  makeProject,
  makeTask,
  seedTestDb,
  TEST_NOW,
} from "./test-db";

describe("labels persistence on fake-indexeddb", () => {
  let db: NanoboardDB;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestDb(db, buildTestContents());
  });

  afterEach(async () => {
    await db.close();
  });

  it("creates, renames, recolors, and deletes labels while enforcing case-insensitive uniqueness", async () => {
    const id = await createLabel(db, "project-1", "  feature  ", "green");
    expect(
      (await getProjectLabels(db, "project-1")).map((l) => l.name),
    ).toContain("feature");

    await expect(
      createLabel(db, "project-1", "FEATURE", "red"),
    ).rejects.toThrow(
      'A label named "FEATURE" already exists in this project.',
    );
    await expect(
      createLabel(db, "project-1", "bad-color", "magenta"),
    ).rejects.toThrow();

    await renameLabel(db, id, "enhancement");
    await updateLabelColor(db, id, "purple");
    expect(await db.labels.get(id)).toMatchObject({
      name: "enhancement",
      color: "purple",
    });

    await expect(renameLabel(db, id, "BUG")).rejects.toThrow(
      'A label named "BUG" already exists in this project.',
    );

    await attachLabel(db, "task-2", id);
    await deleteLabel(db, id);
    expect(await db.labels.get(id)).toBeUndefined();
    expect(await db.taskLabels.where("labelId").equals(id).count()).toBe(0);
  });

  it("enforces same-project attachment, treats duplicate attach and missing detach as no-ops", async () => {
    await db.projects.add(
      makeProject({ id: "project-2", name: "Second", slug: "SP", position: 1 }),
    );
    const foreignLabelId = await createLabel(db, "project-2", "other", "gray");

    await expect(attachLabel(db, "task-1", foreignLabelId)).rejects.toThrow(
      "Label and task must belong to the same project.",
    );

    // Re-attaching an existing pair is a no-op.
    await attachLabel(db, "task-1", "label-bug");
    expect((await getTaskLabels(db, "task-1")).map((l) => l.id)).toEqual([
      "label-bug",
    ]);

    await detachLabel(db, "task-1", "label-bug");
    await expect(
      detachLabel(db, "task-1", "label-bug"),
    ).resolves.toBeUndefined();
    expect(await getTaskLabels(db, "task-1")).toEqual([]);
  });

  it("excludes archived tasks from getProjectTaskLabels unless includeArchived is set", async () => {
    await db.tasks.add(
      makeTask({
        id: "task-archived",
        number: 9,
        archivedAt: TEST_NOW,
      }),
    );
    await attachLabel(db, "task-archived", "label-bug");

    const activeMap = await getProjectTaskLabels(db, "project-1");
    expect(activeMap.has("task-1")).toBe(true);
    expect(activeMap.has("task-archived")).toBe(false);

    const allMap = await getProjectTaskLabels(db, "project-1", {
      includeArchived: true,
    });
    expect(allMap.has("task-archived")).toBe(true);
  });
});
