import { describe, expect, it } from "vitest";
import { dataUrlToBlob } from "../data-url";
import {
  buildTestContents,
  createTestDb,
  seedTestDb,
  TEST_NOW,
  TEST_PAGE_ASSET_BYTES,
  type TestDbContents,
} from "../db/test-db";
import { createBackupDocument } from "./create";
import { serializeBackupDocument } from "./serialize";

/** An app with nothing in it yet: every table empty. */
const EMPTY_CONTENTS: TestDbContents = {
  projects: [],
  columns: [],
  tasks: [],
  labels: [],
  taskLabels: [],
  taskResources: [],
  stickies: [],
  whiteboards: [],
  whiteboardPreviews: [],
  pages: [],
  pageContents: [],
  pageAssets: [],
};

describe("createBackupDocument", () => {
  it("builds the v1 envelope header and a tables map with exactly the known tables", async () => {
    const db = createTestDb();

    const document = await createBackupDocument(db);

    expect(document.format).toBe("nanoboard-backup");
    expect(document.version).toBe(1);
    // The app's own version constant, injected at build time.
    expect(document.appVersion).toBe(__APP_VERSION__);
    // The export time is a canonical ISO timestamp.
    expect(new Date(document.exportedAt).toISOString()).toBe(
      document.exportedAt,
    );

    // Every table of the schema is present — exactly the known set, no
    // extras, no omissions — and each holds raw rows as an array.
    expect(Object.keys(document.tables).sort()).toEqual(
      [
        "columns",
        "labels",
        "pageAssets",
        "pageContents",
        "pages",
        "projects",
        "stickies",
        "taskLabels",
        "taskResources",
        "tasks",
        "whiteboards",
        "whiteboardPreviews",
      ].sort(),
    );
    for (const rows of Object.values(document.tables)) {
      expect(Array.isArray(rows)).toBe(true);
    }

    await db.close();
  });

  it("exports a fresh, empty app as a valid backup with empty tables", async () => {
    const db = createTestDb();
    // A brand-new app holds no rows before the user creates anything.
    await seedTestDb(db, EMPTY_CONTENTS);

    const document = await createBackupDocument(db);

    expect(document.format).toBe("nanoboard-backup");
    expect(document.version).toBe(1);
    expect(Object.keys(document.tables).sort()).toHaveLength(12);
    for (const rows of Object.values(document.tables)) {
      expect(rows).toEqual([]);
    }

    await db.close();
  });

  it("carries the raw rows of a populated workspace, serializing pageAssets blobs to data URLs", async () => {
    const db = createTestDb();
    const contents = buildTestContents();
    await seedTestDb(db, contents);

    const document = await createBackupDocument(db);

    // Every table round-trips verbatim — IDs, positions, task numbers,
    // timestamps, and the branded slug/date strings (which are plain
    // strings at runtime) come back untouched.
    expect(document.tables.projects).toEqual(contents.projects);
    expect(document.tables.columns).toEqual(contents.columns);
    expect(document.tables.tasks).toEqual(contents.tasks);
    expect(document.tables.labels).toEqual(contents.labels);
    // The label-assignment join keeps its compound-key rows intact.
    expect(document.tables.taskLabels).toEqual(contents.taskLabels);
    expect(document.tables.taskResources).toEqual(contents.taskResources);
    expect(document.tables.stickies).toEqual(contents.stickies);

    // Whiteboards carry the full Excalidraw scene triple: the stored
    // element, the durable app state, and image files as data URLs.
    expect(document.tables.whiteboards).toEqual(contents.whiteboards);
    const whiteboard = document.tables.whiteboards[0];
    expect(whiteboard?.elements[0]?.type).toBe("rectangle");
    expect(whiteboard?.appState.viewBackgroundColor).toBe("#fefefe");
    expect(whiteboard?.files["file-1"]?.dataURL).toMatch(
      /^data:image\/png;base64,/,
    );

    // Previews ride along as plain rows — the thumbnail is just a string,
    // kept verbatim like every other field.
    expect(document.tables.whiteboardPreviews).toEqual(
      contents.whiteboardPreviews,
    );
    expect(document.tables.whiteboardPreviews[0]?.dataUrl).toMatch(
      /^data:image\/jpeg;base64,/,
    );

    // Pages and pageContents ride along verbatim; pageAssets replace the
    // binary Blob with a lossless base64 dataUrl.
    expect(document.tables.pages).toEqual(contents.pages);
    expect(document.tables.pageContents).toEqual(contents.pageContents);
    expect(document.tables.pageAssets).toHaveLength(1);
    const exportedAsset = document.tables.pageAssets[0]!;
    expect(exportedAsset.id).toBe("page-asset-1");
    expect(exportedAsset.pageId).toBe("page-1");
    expect(exportedAsset.projectId).toBe("project-1");
    expect(exportedAsset.name).toBe("diagram.png");
    expect(exportedAsset.mimeType).toBe("image/png");
    expect(exportedAsset.size).toBe(TEST_PAGE_ASSET_BYTES.length);
    expect(exportedAsset.createdAt).toBe(TEST_NOW);
    expect("blob" in exportedAsset).toBe(false);
    expect(exportedAsset.dataUrl).toMatch(/^data:image\/png;base64,/);
    const decoded = dataUrlToBlob(exportedAsset.dataUrl);
    expect(new Uint8Array(await decoded.arrayBuffer())).toEqual(
      TEST_PAGE_ASSET_BYTES,
    );

    await db.close();
  });

  it("carries archivedAt on archived task and page rows, exactly as stored", async () => {
    const db = createTestDb();
    const contents = buildTestContents();
    contents.tasks[0] = { ...contents.tasks[0], archivedAt: TEST_NOW + 5 };
    contents.pages[0] = { ...contents.pages[0], archivedAt: TEST_NOW + 9 };
    await seedTestDb(db, contents);

    const document = await createBackupDocument(db);

    // Archive state is ordinary row data: exported verbatim on the rows
    // that carry it, absent on the ones that don't.
    expect(document.tables.tasks[0]?.archivedAt).toBe(TEST_NOW + 5);
    expect(document.tables.tasks[1]?.archivedAt).toBeUndefined();
    expect(document.tables.pages[0]?.archivedAt).toBe(TEST_NOW + 9);

    await db.close();
  });

  it("serializes minified — one line, no formatting whitespace, lossless", async () => {
    const db = createTestDb();
    const contents = buildTestContents();
    await seedTestDb(db, contents);

    const document = await createBackupDocument(db);
    const json = serializeBackupDocument(document);

    // A single line, with none of the separators pretty-printing adds.
    expect(json.split("\n")).toHaveLength(1);
    expect(json).not.toContain('": ');
    expect(json).not.toContain(", ");

    // Lossless: the text parses back to the exact document.
    expect(JSON.parse(json)).toEqual(document);

    // And it is genuinely minified, not merely differently formatted.
    expect(json.length).toBeLessThan(JSON.stringify(document, null, 2).length);

    await db.close();
  });
});
