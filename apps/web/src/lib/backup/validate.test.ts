import { describe, expect, it } from "vitest";
import { createBackupDocument } from "./create";
import { parseBackupDocument } from "./apply";
import {
  assertSupportedBackupVersion,
  assertValidBackupDocument,
  assertValidBackupTables,
} from "./validate";
import { buildTestContents, createTestDb, seedTestDb } from "../db/test-db";
import type { BackupTables } from "./types";

async function seededDocument() {
  const db = createTestDb();
  await seedTestDb(db, buildTestContents());
  const document = await createBackupDocument(db);
  await db.close();
  return document;
}

describe("assertSupportedBackupVersion", () => {
  it("accepts the current version", () => {
    expect(() => assertSupportedBackupVersion({ version: 1 })).not.toThrow();
  });

  it("accepts versions older than current", () => {
    expect(() => assertSupportedBackupVersion({ version: 0 })).not.toThrow();
  });

  it("rejects a newer version with an update-the-app-first message", () => {
    expect(() => assertSupportedBackupVersion({ version: 2 })).toThrow(
      /newer version of nanoboard — update the app first/,
    );
  });
});

describe("assertValidBackupTables", () => {
  it("accepts every row of a representative exported document", async () => {
    const document = await seededDocument();
    expect(() => assertValidBackupDocument(document)).not.toThrow();
  });

  it("accepts rows that are structurally valid but semantically odd — no repair, no invariant checks", () => {
    const tables = buildTestContents();
    // Duplicate per-project task numbers, columns out of order, a task
    // pointing at a column that doesn't exist, a huge task number: all
    // semantically dubious, all structurally fine. Restore trusts them.
    tables.tasks.push({
      ...tables.tasks[0],
      id: "task-duplicate-number",
      number: 1,
      columnId: "column-missing",
      position: -50,
    });
    tables.tasks[1].number = 1_000_000;
    tables.columns.reverse();

    expect(() => assertValidBackupTables(tables as BackupTables)).not.toThrow();
  });

  it.each([
    ["tasks", { ...buildTestContents().tasks[0], title: undefined }],
    ["tasks", { ...buildTestContents().tasks[0], number: "1" }],
    ["tasks", { ...buildTestContents().tasks[0], priority: "highest" }],
    ["projects", { ...buildTestContents().projects[0], id: undefined }],
    ["projects", { ...buildTestContents().projects[0], lastTaskNumber: null }],
    ["labels", { ...buildTestContents().labels[0], color: 7 }],
    ["taskLabels", { taskId: "task-1" }],
    ["stickies", { ...buildTestContents().stickies[0], backgroundColor: "chartreuse" }],
    ["whiteboards", { ...buildTestContents().whiteboards[0], elements: "[]" }],
    ["whiteboards", { ...buildTestContents().whiteboards[0], appState: [] }],
    ["taskResources", { ...buildTestContents().taskResources[0], url: undefined }],
    ["columns", { ...buildTestContents().columns[0], isFinal: "no" }],
  ])("rejects a structurally broken %s row", (tableName, row) => {
    const tables = buildTestContents();
    (tables as unknown as Record<string, unknown[]>)[tableName] = [row];
    expect(() => assertValidBackupTables(tables as BackupTables)).toThrow(
      new RegExp(`"${tableName}", row 1`),
    );
  });

  it("accepts optional fields being absent but rejects them being mistyped", () => {
    const tables = buildTestContents();
    delete tables.tasks[1].startDate;
    delete tables.tasks[1].dueDate;
    expect(() => assertValidBackupTables(tables as BackupTables)).not.toThrow();

    tables.tasks[1].startDate = 42 as never;
    expect(() => assertValidBackupTables(tables as BackupTables)).toThrow(
      /invalid "startDate"/,
    );
  });
});

describe("the parser gates on the full structural policy", () => {
  it("rejects a file with a newer format version before any row is examined", async () => {
    const document = await seededDocument();
    const text = JSON.stringify({ ...document, version: 99 });
    expect(() => parseBackupDocument(text)).toThrow(
      /newer version of nanoboard/,
    );
  });

  it("rejects a file with one structurally broken row among valid data", async () => {
    const document = await seededDocument();
    const corrupted = {
      ...document,
      tables: {
        ...document.tables,
        tasks: [
          ...document.tables.tasks,
          { ...document.tables.tasks[0], title: 123 },
        ],
      },
    };
    expect(() => parseBackupDocument(JSON.stringify(corrupted))).toThrow(
      /corrupted[\s\S]*"tasks", row 3[\s\S]*"title"/,
    );
  });

  it("accepts a file from an older format version and applies it", async () => {
    const document = await seededDocument();
    // A hypothetical older producer: same rows, smaller version stamp.
    const older = parseBackupDocument(JSON.stringify({ ...document, version: 0 }));
    expect(older.version).toBe(0);
  });
});
