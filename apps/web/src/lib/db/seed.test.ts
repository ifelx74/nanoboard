import { describe, expect, it } from "vitest";
import { buildSeedRows, resetToSeed } from "./seed";
import { suggestProjectKey } from "../task-key";
import { DEFAULT_COLUMNS } from "./schema";
import { createTestDb } from "./test-db";

describe("demo seed rows", () => {
  it("builds an internally consistent demo workspace", () => {
    const rows = buildSeedRows();

    expect(rows.projects).toHaveLength(2);
    expect(rows.columns).toHaveLength(10);
    expect(rows.tasks).toHaveLength(9);
    expect(rows.labels).toHaveLength(7);
    expect(rows.taskLabels).toHaveLength(6);

    const projectIds = new Set(rows.projects.map((p) => p.id));
    const columnIds = new Set(rows.columns.map((c) => c.id));
    const taskIds = new Set(rows.tasks.map((t) => t.id));
    const labelIds = new Set(rows.labels.map((l) => l.id));

    for (const column of rows.columns) {
      expect(projectIds.has(column.projectId)).toBe(true);
    }
    for (const task of rows.tasks) {
      expect(projectIds.has(task.projectId)).toBe(true);
      expect(columnIds.has(task.columnId)).toBe(true);
    }
    for (const label of rows.labels) {
      expect(projectIds.has(label.projectId)).toBe(true);
    }
    for (const join of rows.taskLabels) {
      expect(taskIds.has(join.taskId)).toBe(true);
      expect(labelIds.has(join.labelId)).toBe(true);
    }

    // Rows look app-created: derived keys, DEFAULT_COLUMNS board, and ids
    // unique across every table.
    for (const project of rows.projects) {
      expect(project.slug).toBe(suggestProjectKey(project.name));
      expect(project.lastTaskNumber).toBe(
        rows.tasks.filter((task) => task.projectId === project.id).length,
      );
    }
    for (const project of rows.projects) {
      const slugs = rows.columns
        .filter((column) => column.projectId === project.id)
        .map((column) => column.slug);
      expect(slugs).toEqual(DEFAULT_COLUMNS.map((def) => def.slug));
    }
    const ids = [
      ...rows.projects,
      ...rows.columns,
      ...rows.tasks,
      ...rows.labels,
    ].map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resetToSeed fills an empty database with exactly the demo rows", async () => {
    // Tests register no populate seeding, so a fresh database starts empty
    // and everything resetToSeed writes is its own.
    const db = createTestDb();
    await resetToSeed(db);

    const rows = buildSeedRows();
    expect(await db.projects.count()).toBe(rows.projects.length);
    expect(await db.columns.count()).toBe(rows.columns.length);
    expect(await db.tasks.count()).toBe(rows.tasks.length);
    expect(await db.labels.count()).toBe(rows.labels.length);
    expect(await db.taskLabels.count()).toBe(rows.taskLabels.length);

    // A reset on a non-empty database replaces rather than duplicates.
    await resetToSeed(db);
    expect(await db.tasks.count()).toBe(rows.tasks.length);

    await db.close();
  });
});
