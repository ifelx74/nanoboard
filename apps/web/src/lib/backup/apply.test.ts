import { describe, expect, it } from "vitest";
import { createBackupDocument } from "./create";
import {
  applyBackupDocument,
  backupTableCounts,
  parseBackupDocument,
} from "./apply";
import { serializeBackupDocument } from "./serialize";
import {
  buildTestContents,
  createTestDb,
  makeTask,
  seedTestDb,
  TEST_NOW,
  type TestDbContents,
} from "../db/test-db";

/** A populated workspace distinct from buildTestContents(): extra rows the
 * round-trip target must NOT retain after a replace-all restore. */
function buildOtherContents(): TestDbContents {
  const contents = buildTestContents(TEST_NOW + 60_000);
  contents.projects.push({
    ...contents.projects[0],
    id: "project-extra",
    name: "Extra project",
    slug: "EP",
    position: 1,
  });
  contents.stickies.push({
    ...contents.stickies[0],
    id: "sticky-extra",
    position: 1,
  });
  contents.tasks.push(
    makeTask({ id: "task-extra", number: 9, createdAt: TEST_NOW + 60_000, updatedAt: TEST_NOW + 60_000 }),
  );
  return contents;
}

async function readAllTables(db: Parameters<typeof applyBackupDocument>[0]) {
  return {
    projects: await db.projects.toArray(),
    columns: await db.columns.toArray(),
    tasks: await db.tasks.toArray(),
    labels: await db.labels.toArray(),
    taskLabels: await db.taskLabels.toArray(),
    taskResources: await db.taskResources.toArray(),
    stickies: await db.stickies.toArray(),
    whiteboards: await db.whiteboards.toArray(),
  };
}

describe("parseBackupDocument", () => {
  it("rejects text that is not JSON at all", () => {
    expect(() => parseBackupDocument("this is not json")).toThrow(
      /not valid JSON/,
    );
  });

  it("rejects JSON without the nanoboard backup format identifier", () => {
    expect(() => parseBackupDocument('{"foo": 1}')).toThrow(/nanoboard backup/);
    expect(() => parseBackupDocument('{"format": "other-app"}')).toThrow(
      /nanoboard backup/,
    );
  });

  it("parses a serialized document back to an equal document", async () => {
    const db = createTestDb();
    await seedTestDb(db);
    const document = await createBackupDocument(db);

    const parsed = parseBackupDocument(serializeBackupDocument(document));

    expect(parsed).toEqual(document);
    await db.close();
  });

  it("tolerates a file missing known tables and ignores unknown ones", () => {
    const parsed = parseBackupDocument(
      JSON.stringify({
        format: "nanoboard-backup",
        version: 1,
        tables: {
          projects: [],
          stickies: [{ id: "sticky-1" }],
          brandNewTable: [{ id: "x" }],
        },
      }),
    );

    expect(parsed.tables.projects).toEqual([]);
    expect(parsed.tables.stickies).toEqual([{ id: "sticky-1" }]);
    expect(parsed.tables.tasks).toEqual([]);
    expect(Object.keys(parsed.tables)).not.toContain("brandNewTable");
  });
});

describe("backupTableCounts", () => {
  it("counts rows per table", async () => {
    const db = createTestDb();
    const contents = buildTestContents();
    await seedTestDb(db, contents);
    const document = await createBackupDocument(db);

    expect(backupTableCounts(document)).toEqual({
      projects: 1,
      columns: 3,
      tasks: 2,
      labels: 2,
      taskLabels: 1,
      taskResources: 1,
      stickies: 1,
      whiteboards: 1,
    });

    await db.close();
  });
});

describe("applyBackupDocument", () => {
  it("round-trips: export from one database, restore into another, identical state", async () => {
    const source = createTestDb();
    const contents = buildTestContents();
    await seedTestDb(source, contents);
    const document = await createBackupDocument(source);
    const text = serializeBackupDocument(document);

    const target = createTestDb();
    await seedTestDb(target, buildOtherContents());
    await applyBackupDocument(target, parseBackupDocument(text));

    expect(await readAllTables(target)).toEqual({
      projects: contents.projects,
      columns: contents.columns,
      tasks: contents.tasks,
      labels: contents.labels,
      taskLabels: contents.taskLabels,
      taskResources: contents.taskResources,
      stickies: contents.stickies,
      whiteboards: contents.whiteboards,
    });

    await source.close();
    await target.close();
  });

  it("restores over a populated app, removing rows the backup doesn't contain", async () => {
    const source = createTestDb();
    await seedTestDb(source, buildTestContents());
    const document = await createBackupDocument(source);

    const target = createTestDb();
    await seedTestDb(target, buildOtherContents());
    await applyBackupDocument(target, document);

    // The extra rows unique to the target are gone, and the target now
    // matches the source exactly.
    expect(await target.projects.get("project-extra")).toBeUndefined();
    expect(await target.stickies.get("sticky-extra")).toBeUndefined();
    expect(await target.tasks.get("task-extra")).toBeUndefined();
    expect(await target.projects.count()).toBe(1);
    expect(await target.tasks.count()).toBe(2);
    expect(await target.stickies.count()).toBe(1);

    await source.close();
    await target.close();
  });

  it("leaves the database untouched when a row fails a store-level constraint", async () => {
    const source = createTestDb();
    await seedTestDb(source);
    const document = await createBackupDocument(source);
    // Corrupt the document: a second task reusing task-1's per-project
    // number violates the store-enforced unique [projectId+number] index.
    document.tables.tasks.push(makeTask({ id: "task-duplicate", number: 1 }));

    const target = createTestDb();
    const original = buildOtherContents();
    await seedTestDb(target, original);

    await expect(applyBackupDocument(target, document)).rejects.toThrow();

    // Atomic: nothing was wiped, nothing was half-inserted.
    expect(await readAllTables(target)).toEqual({
      projects: original.projects,
      columns: original.columns,
      tasks: original.tasks,
      labels: original.labels,
      taskLabels: original.taskLabels,
      taskResources: original.taskResources,
      stickies: original.stickies,
      whiteboards: original.whiteboards,
    });

    await source.close();
    await target.close();
  });

  it("restores an empty backup into a populated app, wiping it", async () => {
    const empty = parseBackupDocument(
      JSON.stringify({ format: "nanoboard-backup", version: 1, tables: {} }),
    );

    const target = createTestDb();
    await seedTestDb(target);
    await applyBackupDocument(target, empty);

    for (const table of [
      target.projects,
      target.columns,
      target.tasks,
      target.labels,
      target.taskLabels,
      target.taskResources,
      target.stickies,
      target.whiteboards,
    ]) {
      expect(await table.count()).toBe(0);
    }

    await target.close();
  });
});
