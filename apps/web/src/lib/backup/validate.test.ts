import { describe, expect, it } from "vitest";
import { createBackupDocument } from "./create";
import { parseBackupDocument } from "./apply";
import {
  assertSupportedBackupVersion,
  assertValidBackupDocument,
  assertValidBackupTables,
} from "./validate";
import {
  buildTestContents,
  createTestDb,
  seedTestDb,
  TEST_FILE_DATA_URL,
  TEST_NOW,
} from "../db/test-db";
import type { BackupTables } from "./types";

function buildValidBackupTables(): BackupTables {
  const contents = buildTestContents();
  return {
    ...contents,
    pageAssets: contents.pageAssets.map((asset) => ({
      id: asset.id,
      pageId: asset.pageId,
      projectId: asset.projectId,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
      dataUrl: TEST_FILE_DATA_URL,
      createdAt: asset.createdAt,
    })),
  };
}

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

  it("accepts the newest restorable version (a v2 encrypted envelope)", () => {
    expect(() => assertSupportedBackupVersion({ version: 2 })).not.toThrow();
  });

  it("rejects a newer version with an update-the-app-first message", () => {
    expect(() => assertSupportedBackupVersion({ version: 3 })).toThrow(
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
    const tables = buildValidBackupTables();
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

    expect(() => assertValidBackupTables(tables)).not.toThrow();
  });

  it("accepts all valid PageLogo variants (null, emoji, icon) and optional page archivedAt", () => {
    const tables = buildValidBackupTables();
    const basePage = tables.pages[0]!;
    tables.pages = [
      { ...basePage, id: "p-null", logo: null },
      { ...basePage, id: "p-emoji", logo: { type: "emoji", value: "🚀" } },
      {
        ...basePage,
        id: "p-icon",
        logo: { type: "icon", name: "Rocket", color: "#5e6ad2" },
        archivedAt: TEST_NOW + 100,
      },
      { ...basePage, id: "p-epoch", logo: null, archivedAt: 0 },
    ];
    expect(() => assertValidBackupTables(tables)).not.toThrow();
  });

  it.each([
    ["tasks", { ...buildValidBackupTables().tasks[0], title: undefined }],
    ["tasks", { ...buildValidBackupTables().tasks[0], number: "1" }],
    ["tasks", { ...buildValidBackupTables().tasks[0], priority: "highest" }],
    ["projects", { ...buildValidBackupTables().projects[0], id: undefined }],
    [
      "projects",
      { ...buildValidBackupTables().projects[0], lastTaskNumber: null },
    ],
    ["labels", { ...buildValidBackupTables().labels[0], color: 7 }],
    ["taskLabels", { taskId: "task-1" }],
    [
      "stickies",
      {
        ...buildValidBackupTables().stickies[0],
        backgroundColor: "chartreuse",
      },
    ],
    [
      "whiteboards",
      { ...buildValidBackupTables().whiteboards[0], elements: "[]" },
    ],
    [
      "whiteboards",
      { ...buildValidBackupTables().whiteboards[0], appState: [] },
    ],
    [
      "whiteboardPreviews",
      {
        ...buildValidBackupTables().whiteboardPreviews[0],
        projectId: undefined,
      },
    ],
    [
      "whiteboardPreviews",
      { ...buildValidBackupTables().whiteboardPreviews[0], dataUrl: 42 },
    ],
    [
      "whiteboardPreviews",
      { ...buildValidBackupTables().whiteboardPreviews[0], updatedAt: "now" },
    ],
    [
      "taskResources",
      { ...buildValidBackupTables().taskResources[0], url: undefined },
    ],
    ["columns", { ...buildValidBackupTables().columns[0], isFinal: "no" }],
    ["pages", { ...buildValidBackupTables().pages[0], title: 123 }],
    ["pages", { ...buildValidBackupTables().pages[0], logo: "🚀" }],
    [
      "pages",
      {
        ...buildValidBackupTables().pages[0],
        logo: { type: "emoji", value: "" },
      },
    ],
    [
      "pages",
      {
        ...buildValidBackupTables().pages[0],
        logo: { type: "icon", name: "Rocket" },
      },
    ],
    [
      "pages",
      { ...buildValidBackupTables().pages[0], logo: { type: "other" } },
    ],
    ["pages", { ...buildValidBackupTables().pages[0], isFavorite: "yes" }],
    ["pages", { ...buildValidBackupTables().pages[0], isLocked: 1 }],
    [
      "pages",
      { ...buildValidBackupTables().pages[0], archivedAt: "2026-01-01" },
    ],
    ["pages", { ...buildValidBackupTables().pages[0], archivedAt: Number.NaN }],
    [
      "pageContents",
      { ...buildValidBackupTables().pageContents[0], pageId: undefined },
    ],
    [
      "pageContents",
      { ...buildValidBackupTables().pageContents[0], contentJson: [] },
    ],
    [
      "pageContents",
      { ...buildValidBackupTables().pageContents[0], contentJson: null },
    ],
    [
      "pageContents",
      { ...buildValidBackupTables().pageContents[0], contentText: 42 },
    ],
    [
      "pageAssets",
      { ...buildValidBackupTables().pageAssets[0], id: undefined },
    ],
    ["pageAssets", { ...buildValidBackupTables().pageAssets[0], size: -1 }],
    ["pageAssets", { ...buildValidBackupTables().pageAssets[0], size: "10" }],
    [
      "pageAssets",
      {
        ...buildValidBackupTables().pageAssets[0],
        dataUrl: "https://example.com/a.png",
      },
    ],
    [
      "pageAssets",
      {
        ...buildValidBackupTables().pageAssets[0],
        dataUrl: "data:image/png;base64,ABC",
      },
    ],
    [
      "pageAssets",
      { ...buildValidBackupTables().pageAssets[0], dataUrl: undefined },
    ],
    [
      "pageAssets",
      {
        ...buildValidBackupTables().pageAssets[0],
        createdAt: Number.POSITIVE_INFINITY,
      },
    ],
    [
      "pageAssets",
      {
        ...buildValidBackupTables().pageAssets[0],
        mimeType: "image/svg+xml",
        dataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      },
    ],
    [
      "pageAssets",
      {
        ...buildValidBackupTables().pageAssets[0],
        mimeType: "text/html",
        dataUrl: "data:text/html;base64,PHNjcmlwdD48L3NjcmlwdD4=",
      },
    ],
    [
      "pageAssets",
      {
        ...buildValidBackupTables().pageAssets[0],
        mimeType: "image/png",
        dataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      },
    ],
    [
      "pageAssets",
      {
        ...buildValidBackupTables().pageAssets[0],
        mimeType: "image/png",
        dataUrl: "data:text/html;base64,PHNjcmlwdD48L3NjcmlwdD4=",
      },
    ],
    [
      "pageAssets",
      {
        ...buildValidBackupTables().pageAssets[0],
        mimeType: "image/png",
        dataUrl: "data:image/jpeg;base64,AQID",
      },
    ],
    [
      "pageAssets",
      {
        ...buildValidBackupTables().pageAssets[0],
        mimeType: "image/png",
        dataUrl: "data:image/png;charset=utf-8;base64,AQID",
      },
    ],
  ])("rejects a structurally broken %s row", (tableName, row) => {
    const tables = buildValidBackupTables();
    (tables as unknown as Record<string, unknown[]>)[tableName] = [row];
    expect(() => assertValidBackupTables(tables)).toThrow(
      new RegExp(`"${tableName}", row 1`),
    );
  });

  it("accepts optional fields being absent but rejects them being mistyped", () => {
    const tables = buildValidBackupTables();
    delete tables.tasks[1].startDate;
    delete tables.tasks[1].dueDate;
    expect(() => assertValidBackupTables(tables)).not.toThrow();

    tables.tasks[1].startDate = 42 as never;
    expect(() => assertValidBackupTables(tables)).toThrow(
      /invalid "startDate"/,
    );
  });
});

describe("archivedAt on task rows", () => {
  it("accepts task rows with a finite archivedAt", () => {
    const tables = buildValidBackupTables();
    tables.tasks[0] = { ...tables.tasks[0], archivedAt: TEST_NOW + 1 };
    // 0 is a finite number — the epoch itself is a legal stamp.
    tables.tasks[1] = { ...tables.tasks[1], archivedAt: 0 };
    expect(() => assertValidBackupTables(tables)).not.toThrow();
  });

  it("accepts task rows without archivedAt — pre-feature backups stay valid", () => {
    const tables = buildValidBackupTables();
    for (const task of tables.tasks) delete task.archivedAt;
    expect(() => assertValidBackupTables(tables)).not.toThrow();
  });

  it.each([
    ["a string", "2026-01-01"],
    ["a boolean", true],
    ["NaN", Number.NaN],
    ["an infinity", Number.POSITIVE_INFINITY],
  ])("rejects an archivedAt that is %s as corruption", (_label, value) => {
    const tables = buildValidBackupTables();
    (tables.tasks[0] as { archivedAt: unknown }).archivedAt = value;
    expect(() => assertValidBackupTables(tables)).toThrow(
      /corrupted[\s\S]*"tasks", row 1[\s\S]*"archivedAt"/,
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
    const older = parseBackupDocument(
      JSON.stringify({ ...document, version: 0 }),
    );
    expect(older.version).toBe(0);
  });
});
