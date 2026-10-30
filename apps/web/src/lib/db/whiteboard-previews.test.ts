import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteProject } from "./projects";
import {
  buildTestContents,
  createTestDb,
  makeWhiteboard,
  seedTestDb,
  TEST_NOW,
  TEST_PREVIEW_DATA_URL,
} from "./test-db";
import { forgetWhiteboard, saveWhiteboardScene } from "./whiteboards";
import {
  deleteWhiteboardPreview,
  getWhiteboardPreview,
  saveWhiteboardPreview,
} from "./whiteboard-previews";

describe("whiteboard preview store on fake-indexeddb", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a content-ful save flush upserts exactly one preview row per project", async () => {
    const database = createTestDb();
    await seedTestDb(database);

    // Two content-ful flushes for the same project, an hour apart.
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(TEST_NOW);
    await saveWhiteboardPreview(database, "project-1", "");
    now.mockReturnValue(TEST_NOW + 3_600_000);
    await saveWhiteboardPreview(database, "project-1", TEST_PREVIEW_DATA_URL);

    // One row per project, updated in place: the freshness stamp advanced
    // and the thumbnail was replaced, rather than a second row piling up.
    expect(await database.whiteboardPreviews.count()).toBe(1);
    expect(await getWhiteboardPreview(database, "project-1")).toEqual({
      projectId: "project-1",
      dataUrl: TEST_PREVIEW_DATA_URL,
      updatedAt: TEST_NOW + 3_600_000,
    });

    await database.close();
  });

  it("tracks each project independently", async () => {
    const database = createTestDb();
    await seedTestDb(database);

    await saveWhiteboardPreview(database, "project-2", "");

    expect(await database.whiteboardPreviews.count()).toBe(2);
    expect(await getWhiteboardPreview(database, "project-2")).toMatchObject({
      projectId: "project-2",
      dataUrl: "",
    });
    // The other project's row is untouched.
    expect(await getWhiteboardPreview(database, "project-1")).toMatchObject({
      projectId: "project-1",
      dataUrl: TEST_PREVIEW_DATA_URL,
    });

    await database.close();
  });

  it("an emptied-canvas save flush removes the project's preview row", async () => {
    const database = createTestDb();
    await seedTestDb(database);

    await deleteWhiteboardPreview(database, "project-1");

    expect(await getWhiteboardPreview(database, "project-1")).toBeUndefined();
    expect(await database.whiteboardPreviews.count()).toBe(0);

    await database.close();
  });

  it("removing a preview that was never published is a no-op", async () => {
    const database = createTestDb();
    await seedTestDb(database);

    // A project that never drew has no row; the flush's removal step must
    // not throw on the absent row.
    await expect(
      deleteWhiteboardPreview(database, "never-drawn"),
    ).resolves.toBeUndefined();

    await database.close();
  });
});

describe("project deletion eviction on fake-indexeddb", () => {
  it("deleting a project evicts its preview row alongside the scene row", async () => {
    const database = createTestDb();
    await seedTestDb(database);

    await deleteProject(database, "project-1");

    // The preview row goes in the same deletion transaction as the scene
    // row and the project itself — no orphaned gallery index entries.
    expect(await getWhiteboardPreview(database, "project-1")).toBeUndefined();
    expect(await database.whiteboardPreviews.count()).toBe(0);
    expect(
      await database.whiteboards.where("projectId").equals("project-1").count(),
    ).toBe(0);
    expect(await database.projects.get("project-1")).toBeUndefined();

    await database.close();
  });

  it("deleting a project that never drew (no preview row) still succeeds", async () => {
    const database = createTestDb();
    await seedTestDb(database, {
      ...buildTestContents(),
      whiteboards: [],
      whiteboardPreviews: [],
    });

    await expect(deleteProject(database, "project-1")).resolves.toBeUndefined();
    expect(await database.projects.get("project-1")).toBeUndefined();

    await database.close();
  });
});

describe("the save flush's two stores on fake-indexeddb", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    forgetWhiteboard("project-flush");
    forgetWhiteboard("project-failure");
  });

  it("an emptied-canvas flush persists the scene row but removes the preview", async () => {
    const database = createTestDb();
    await seedTestDb(database, {
      ...buildTestContents(),
      whiteboardPreviews: [],
    });
    // First-ever flush for a board the user drew on and then emptied.
    await saveWhiteboardPreview(database, "project-flush", "");

    const payload = { elements: [], appState: {}, files: {} };
    // The flush order the canvas runs: the authoritative scene save first...
    await saveWhiteboardScene(database, "project-flush", payload);
    // ...then the preview verdict — remove on an empty payload.
    await deleteWhiteboardPreview(database, "project-flush");

    // The scene row's own lazy-creation lifecycle is unchanged: an emptied
    // canvas still persists its (now empty) scene row.
    const scene = await database.whiteboards
      .where("projectId")
      .equals("project-flush")
      .first();
    expect(scene?.elements).toEqual([]);
    // The preview row is gone: the gallery never lists an emptied board.
    expect(
      await getWhiteboardPreview(database, "project-flush"),
    ).toBeUndefined();
    expect(await database.whiteboardPreviews.count()).toBe(0);

    await database.close();
  });

  it("a content-ful flush persists the scene and publishes the preview", async () => {
    const database = createTestDb();
    await seedTestDb(database, {
      ...buildTestContents(),
      whiteboardPreviews: [],
    });
    vi.spyOn(Date, "now").mockReturnValue(TEST_NOW);

    const scene = makeWhiteboard({ id: "whiteboard-flush" });
    const payload = {
      elements: scene.elements,
      appState: scene.appState,
      files: scene.files,
    };
    await saveWhiteboardScene(database, "project-flush", payload);
    await saveWhiteboardPreview(database, "project-flush", "");

    const saved = await database.whiteboards
      .where("projectId")
      .equals("project-flush")
      .first();
    expect(saved?.elements).toHaveLength(1);
    expect(await getWhiteboardPreview(database, "project-flush")).toEqual({
      projectId: "project-flush",
      dataUrl: "",
      updatedAt: TEST_NOW,
    });

    await database.close();
  });

  it("a failed preview write neither blocks nor corrupts the scene save", async () => {
    const database = createTestDb();
    await seedTestDb(database, {
      ...buildTestContents(),
      whiteboardPreviews: [],
    });
    vi.spyOn(Date, "now").mockReturnValue(TEST_NOW);

    const scene = makeWhiteboard({ id: "whiteboard-failure" });
    const payload = {
      elements: scene.elements,
      appState: scene.appState,
      files: scene.files,
    };
    // The authoritative scene save lands first...
    await saveWhiteboardScene(database, "project-failure", payload);
    // ...then the preview write fails (undefined primary key simulates the
    // store-level rejection a quota or private-mode failure produces).
    await expect(
      saveWhiteboardPreview(database, undefined as unknown as string, ""),
    ).rejects.toThrow();

    // The scene save is intact and authoritative; the failed preview left
    // nothing behind in either store.
    const saved = await database.whiteboards
      .where("projectId")
      .equals("project-failure")
      .first();
    expect(saved?.elements).toHaveLength(1);
    expect(await database.whiteboardPreviews.count()).toBe(0);

    // The store still works for a valid write afterwards.
    await saveWhiteboardPreview(database, "project-failure", "");
    expect(
      await getWhiteboardPreview(database, "project-failure"),
    ).toBeDefined();

    await database.close();
  });
});
