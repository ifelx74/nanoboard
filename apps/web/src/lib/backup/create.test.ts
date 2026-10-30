import { describe, expect, it } from "vitest";
import {
  buildTestContents,
  createTestDb,
  seedTestDb,
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
        "projects",
        "stickies",
        "taskLabels",
        "taskResources",
        "tasks",
        "whiteboards",
      ].sort(),
    );
    for (const rows of Object.values(document.tables)) {
      expect(Array.isArray(rows)).toBe(true);
    }

    await db.close();
  });

  it("exports a fresh, empty app as a valid backup with empty tables", async () => {
    const db = createTestDb();
    // Wipe the fresh-boot populate seeding: the state a brand-new app has
    // before the user creates anything.
    await seedTestDb(db, EMPTY_CONTENTS);

    const document = await createBackupDocument(db);

    expect(document.format).toBe("nanoboard-backup");
    expect(document.version).toBe(1);
    expect(Object.keys(document.tables).sort()).toHaveLength(8);
    for (const rows of Object.values(document.tables)) {
      expect(rows).toEqual([]);
    }

    await db.close();
  });

  it("carries the raw rows of a populated workspace, exactly as stored", async () => {
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
