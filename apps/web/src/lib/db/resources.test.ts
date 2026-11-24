import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NanoboardDB } from "./db";
import {
  createTaskResource,
  deleteTaskResource,
  getTaskResources,
  RESOURCE_TITLE_MAX,
} from "./resources";
import { buildTestContents, createTestDb, seedTestDb } from "./test-db";

describe("task resources persistence on fake-indexeddb", () => {
  let db: NanoboardDB;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestDb(db, buildTestContents());
  });

  afterEach(async () => {
    await db.close();
  });

  it("creates, lists in chronological order, and deletes URL resources scoped to their task", async () => {
    const id = await createTaskResource(db, "task-1", {
      url: "  https://docs.example.com/spec  ",
      title: "  Spec  ",
    });

    const list = await getTaskResources(db, "task-1");
    expect(list.map((r) => r.id)).toEqual(["resource-1", id]);
    expect(list[1]).toMatchObject({
      url: "https://docs.example.com/spec",
      title: "Spec",
      resourceType: "url",
    });

    // Cannot delete a resource under the wrong task id.
    await expect(deleteTaskResource(db, "task-2", id)).rejects.toThrow(
      "Resource not found.",
    );

    await deleteTaskResource(db, "task-1", id);
    expect((await getTaskResources(db, "task-1")).map((r) => r.id)).toEqual([
      "resource-1",
    ]);
  });

  it("rejects non-http(s) URLs, oversized titles, and missing tasks", async () => {
    await expect(
      createTaskResource(db, "task-1", { url: "javascript:alert(1)" }),
    ).rejects.toThrow("Resource URL must use http or https.");
    await expect(
      createTaskResource(db, "task-1", { url: "not-a-url" }),
    ).rejects.toThrow("Resource URL must be a valid http or https URL.");
    await expect(
      createTaskResource(db, "task-1", {
        url: "https://example.com",
        title: "x".repeat(RESOURCE_TITLE_MAX + 1),
      }),
    ).rejects.toThrow();
    await expect(
      createTaskResource(db, "missing-task", { url: "https://example.com" }),
    ).rejects.toThrow("Task not found.");
  });
});
