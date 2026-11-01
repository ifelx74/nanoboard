// Test-only helper for the data layer. Never imported by app code — the app
// bundle never sees it; `pnpm build` merely typechecks it.
//
// How tests obtain database instances: call `createTestDb()`. It returns a
// brand-new NanoboardDB running on fake-indexeddb (the global IndexedDB
// replacement installed once by importing this module), with a unique
// database name per call so tests never share stores or see each other's
// rows. Tests must not import the `db` singleton from `./db` — data-layer
// functions under test (including the future backup module) take the
// database instance as a parameter instead, which is what keeps them
// isolated and testable.
//
// To give a database content, call `seedTestDb(db)` (or pass custom rows).
// It replaces the contents of all nine tables in one transaction with
// representative rows built by the `make*` factories, so assertions can rely
// on exactly the rows a test chose — never on leftovers from a previous
// write.
import "fake-indexeddb/auto";
import Dexie from "dexie";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import { NanoboardDB } from "./db";
import {
  DEFAULT_PROJECT_ICON,
  columnSlug,
  startDate,
  type Column,
  type DueDateString,
  type Label,
  type Project,
  type Sticky,
  type Task,
  type TaskLabel,
  type TaskResource,
  type Whiteboard,
  type WhiteboardPreview,
} from "./schema";

// Dexie snapshots the browser globals into `Dexie.dependencies` when the
// dexie module is evaluated, which may happen *before* this module installs
// fake-indexeddb (ESM evaluates a test file's imports in declaration order).
// Point it at the freshly installed globals explicitly so the wiring holds
// no matter which module a test imports first.
Dexie.dependencies.indexedDB = globalThis.indexedDB;
Dexie.dependencies.IDBKeyRange = globalThis.IDBKeyRange;

let testDbCounter = 0;

/**
 * A fresh, isolated NanoboardDB on fake-indexeddb, with its own unique
 * database name. The connection opens lazily — on first use the full schema
 * (all migration versions) is created, exactly like a browser first boot.
 * A fresh database holds no rows: demo seeding is dev-only (see db.ts).
 */
export function createTestDb(): NanoboardDB {
  return new NanoboardDB(`nanoboard-test-${++testDbCounter}`);
}

/** Fixed epoch for representative rows, so tests never depend on the clock. */
export const TEST_NOW = 1_700_000_000_000;

/**
 * One representative Excalidraw rectangle: the full stored-element shape
 * (schema rows keep plain JSON). The single assertion-neutralizing cast only
 * bypasses phantom brand fields (Radians, FractionalIndex, GroupId) that
 * carry no runtime presence.
 */
const RECTANGLE_ELEMENT = {
  id: "element-1",
  type: "rectangle",
  x: 10,
  y: 20,
  width: 120,
  height: 80,
  angle: 0,
  strokeColor: "#1e1e1e",
  backgroundColor: "#a5cc82",
  fillStyle: "hachure",
  strokeWidth: 1,
  strokeStyle: "solid",
  roundness: null,
  roughness: 1,
  opacity: 100,
  seed: 42,
  version: 1,
  versionNonce: 43,
  index: null,
  isDeleted: false,
  groupIds: [],
  frameId: null,
  boundElements: null,
  updated: TEST_NOW,
  link: null,
  locked: false,
} as unknown as ExcalidrawElement;

/** A tiny valid PNG, data-URL encoded — representative of stored image files. */
export const TEST_FILE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export function makeProject(
  overrides: Partial<Project> & { id: string },
): Project {
  return {
    name: "Test project",
    slug: "TP",
    icon: DEFAULT_PROJECT_ICON,
    position: 0,
    lastTaskNumber: 1,
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
    ...overrides,
  };
}

export function makeColumn(
  overrides: Partial<Column> & { id: string },
): Column {
  return {
    projectId: "project-1",
    name: "Backlog",
    slug: columnSlug("backlog"),
    position: 0,
    isFinal: false,
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    projectId: "project-1",
    columnId: "column-1",
    status: columnSlug("backlog"),
    title: "Test task",
    description: "",
    position: 0,
    number: 1,
    priority: "no-priority",
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
    ...overrides,
  };
}

export function makeLabel(overrides: Partial<Label> & { id: string }): Label {
  return {
    projectId: "project-1",
    name: "bug",
    color: "red",
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
    ...overrides,
  };
}

export function makeTaskResource(
  overrides: Partial<TaskResource> & { id: string },
): TaskResource {
  return {
    taskId: "task-1",
    resourceType: "url",
    externalId: "https://example.com/guide",
    url: "https://example.com/guide",
    title: "Guide",
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
    ...overrides,
  };
}

export function makeSticky(
  overrides: Partial<Sticky> & { id: string },
): Sticky {
  return {
    contentHtml: "<p>Remember the milk</p>",
    backgroundColor: "peach",
    position: 0,
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
    ...overrides,
  };
}

export function makeWhiteboard(
  overrides: Partial<Whiteboard> & { id: string },
): Whiteboard {
  return {
    projectId: "project-1",
    // Scene-shaped fixtures; the casts only bypass phantom brand fields
    // (DataURL, FileId) that carry no runtime presence.
    elements: [RECTANGLE_ELEMENT],
    appState: { viewBackgroundColor: "#fefefe" },
    files: {
      "file-1": {
        id: "file-1",
        mimeType: "image/png",
        dataURL: TEST_FILE_DATA_URL,
        created: TEST_NOW,
        lastRetrieved: TEST_NOW,
      },
    } as unknown as BinaryFiles,
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
    ...overrides,
  };
}

/** A small fake JPEG data URL — representative of a stored thumbnail. */
export const TEST_PREVIEW_DATA_URL =
  "data:image/jpeg;base64,ZmFrZS10aHVtYm5haWw=";

export function makeWhiteboardPreview(
  overrides: Partial<WhiteboardPreview> & { projectId: string },
): WhiteboardPreview {
  return {
    dataUrl: TEST_PREVIEW_DATA_URL,
    updatedAt: TEST_NOW,
    ...overrides,
  };
}

/** Representative rows of every table, with a consistent reference graph. */
export interface TestDbContents {
  projects: Project[];
  columns: Column[];
  tasks: Task[];
  labels: Label[];
  taskLabels: TaskLabel[];
  taskResources: TaskResource[];
  stickies: Sticky[];
  whiteboards: Whiteboard[];
  whiteboardPreviews: WhiteboardPreview[];
}

/**
 * A small, internally consistent workspace touching every table: one project
 * with three columns, two tasks (one plain, one with dates/priority), two
 * labels with one assignment, one manual link, one sticky, one whiteboard
 * scene complete with a data-URL file, and that project's preview row.
 * Row timestamps default to TEST_NOW; pass `now` to vary them (e.g. for tests
 * that order by updatedAt).
 */
export function buildTestContents(now: number = TEST_NOW): TestDbContents {
  return {
    projects: [
      makeProject({
        id: "project-1",
        lastTaskNumber: 2,
        createdAt: now,
        updatedAt: now,
      }),
    ],
    columns: [
      makeColumn({ id: "column-1", createdAt: now, updatedAt: now }),
      makeColumn({
        id: "column-2",
        name: "In Progress",
        slug: columnSlug("in-progress"),
        position: 1,
        createdAt: now,
        updatedAt: now,
      }),
      makeColumn({
        id: "column-3",
        name: "Completed",
        slug: columnSlug("done"),
        position: 2,
        isFinal: true,
        createdAt: now,
        updatedAt: now,
      }),
    ],
    tasks: [
      makeTask({ id: "task-1", createdAt: now, updatedAt: now }),
      makeTask({
        id: "task-2",
        columnId: "column-2",
        status: columnSlug("in-progress"),
        title: "Wire up the label picker",
        number: 2,
        priority: "high",
        startDate: startDate("2026-01-02"),
        dueDate: "2026-01-31" as DueDateString,
        createdAt: now,
        updatedAt: now,
      }),
    ],
    labels: [
      makeLabel({ id: "label-bug", createdAt: now, updatedAt: now }),
      makeLabel({
        id: "label-docs",
        name: "docs",
        color: "gray",
        createdAt: now,
        updatedAt: now,
      }),
    ],
    taskLabels: [{ taskId: "task-1", labelId: "label-bug" }],
    taskResources: [
      makeTaskResource({ id: "resource-1", createdAt: now, updatedAt: now }),
    ],
    stickies: [makeSticky({ id: "sticky-1", createdAt: now, updatedAt: now })],
    whiteboards: [
      makeWhiteboard({ id: "whiteboard-1", createdAt: now, updatedAt: now }),
    ],
    whiteboardPreviews: [
      makeWhiteboardPreview({ projectId: "project-1", updatedAt: now }),
    ],
  };
}

/**
 * Replace the contents of all nine tables with `contents` in a single
 * transaction. Wiping first means a seeded database holds exactly the rows
 * given, regardless of prior writes.
 */
export async function seedTestDb(
  db: NanoboardDB,
  contents: TestDbContents = buildTestContents(),
): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.projects,
      db.columns,
      db.tasks,
      db.labels,
      db.taskLabels,
      db.taskResources,
      db.stickies,
      db.whiteboards,
      db.whiteboardPreviews,
    ],
    async () => {
      await db.projects.clear();
      await db.columns.clear();
      await db.tasks.clear();
      await db.labels.clear();
      await db.taskLabels.clear();
      await db.taskResources.clear();
      await db.stickies.clear();
      await db.whiteboards.clear();
      await db.whiteboardPreviews.clear();

      await db.projects.bulkAdd(contents.projects);
      await db.columns.bulkAdd(contents.columns);
      await db.tasks.bulkAdd(contents.tasks);
      await db.labels.bulkAdd(contents.labels);
      await db.taskLabels.bulkAdd(contents.taskLabels);
      await db.taskResources.bulkAdd(contents.taskResources);
      await db.stickies.bulkAdd(contents.stickies);
      await db.whiteboards.bulkAdd(contents.whiteboards);
      await db.whiteboardPreviews.bulkAdd(contents.whiteboardPreviews);
    },
  );
}
