import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { planTaskImport } from "../task-transfer/import";
import { buildTaskTransferDocument } from "../task-transfer/export";
import { getProjectColumns } from "./tasks";
import { NanoboardDB } from "./db";
import { importProjectTasks, readProjectTransferSource } from "./transfer";
import {
  buildTestContents,
  createTestDb,
  makeTask,
  seedTestDb,
} from "./test-db";
import { columnSlug } from "./schema";
import type { ImportLabel } from "../task-transfer/types";

const ARCHIVED_ISO = "2026-03-01T10:00:00.000Z";
const ARCHIVED_MS = Date.parse(ARCHIVED_ISO);

describe("importProjectTasks archivedAt", () => {
  let db: NanoboardDB;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestDb(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it("writes an archivedAt-carrying task as archived, bypassing the final-column rule", async () => {
    const columns = await getProjectColumns(db, "project-1");
    // in-progress (column-2) is not final: archiveTask would refuse this,
    // but interchange fidelity requires the stamp to land as-is.
    const plan = planTaskImport(
      [
        {
          title: "Imported archived",
          status: "in-progress",
          archivedAt: ARCHIVED_ISO,
        },
      ],
      columns,
      [],
    );

    const outcomes = await importProjectTasks(db, "project-1", plan.tasks);

    expect(outcomes.map((outcome) => outcome.success)).toEqual([true]);
    const imported = (await db.tasks.toArray()).find(
      (task) => task.title === "Imported archived",
    );
    expect(imported?.columnId).toBe("column-2");
    expect(imported?.archivedAt).toBe(ARCHIVED_MS);
  });

  it("imports a legacy document without archivedAt as active", async () => {
    const columns = await getProjectColumns(db, "project-1");
    const plan = planTaskImport(
      [{ title: "Legacy import", status: "done" }],
      columns,
      [],
    );

    const outcomes = await importProjectTasks(db, "project-1", plan.tasks);

    expect(outcomes.map((outcome) => outcome.success)).toEqual([true]);
    const imported = (await db.tasks.toArray()).find(
      (task) => task.title === "Legacy import",
    );
    expect(imported).toBeDefined();
    expect(imported?.archivedAt).toBeUndefined();
  });

  it("round-trips archive state: export then import yields an archived row", async () => {
    const base = buildTestContents();
    const sourceDb = createTestDb();
    await seedTestDb(sourceDb, {
      ...base,
      tasks: [
        ...base.tasks,
        makeTask({
          id: "task-3",
          columnId: "column-3",
          status: columnSlug("done"),
          title: "Ship the release",
          number: 3,
          position: 0,
          archivedAt: ARCHIVED_MS,
        }),
      ],
    });
    const source = await readProjectTransferSource(sourceDb, "project-1");
    const document = await buildTaskTransferDocument(source);
    await sourceDb.close();

    const columns = await getProjectColumns(db, "project-1");
    const existingLabels: ImportLabel[] = [];
    const plan = planTaskImport(document.tasks, columns, existingLabels);

    const outcomes = await importProjectTasks(db, "project-1", plan.tasks);

    expect(outcomes.every((outcome) => outcome.success)).toBe(true);
    const imported = (await db.tasks.toArray()).find(
      (task) => task.title === "Ship the release",
    );
    expect(imported?.archivedAt).toBe(ARCHIVED_MS);
  });
});
