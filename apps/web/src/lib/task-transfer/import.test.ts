import { describe, expect, it } from "vitest";
import { columnSlug } from "../db/schema";
import type { ImportColumn } from "./types";
import { planTaskImport } from "./import";

const COLUMNS: ImportColumn[] = [
  { id: "column-1", slug: columnSlug("backlog"), name: "Backlog", position: 0 },
  {
    id: "column-2",
    slug: columnSlug("in-progress"),
    name: "In Progress",
    position: 1,
  },
  { id: "column-3", slug: columnSlug("done"), name: "Completed", position: 2 },
];

describe("planTaskImport archivedAt", () => {
  it("carries a present archivedAt as epoch ms on the planned task", () => {
    const plan = planTaskImport(
      [
        {
          title: "Ship the release",
          status: "done",
          archivedAt: "2026-03-01T10:00:00.000Z",
        },
      ],
      COLUMNS,
      [],
    );

    expect(plan.failures).toEqual([]);
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0]?.archivedAt).toBe(
      Date.parse("2026-03-01T10:00:00.000Z"),
    );
    expect(plan.tasks[0]?.warnings).toEqual([]);
  });

  it("treats absent and null archivedAt as active, legacy files included", () => {
    const plan = planTaskImport(
      [
        { title: "No field at all", status: "done" },
        { title: "Explicit null", status: "done", archivedAt: null },
      ],
      COLUMNS,
      [],
    );

    expect(plan.failures).toEqual([]);
    for (const task of plan.tasks) {
      expect(task.archivedAt).toBeUndefined();
      expect(task.warnings).toEqual([]);
    }
  });

  it("ignores a malformed archivedAt with a warning and plans the task as active", () => {
    const plan = planTaskImport(
      [
        { title: "Bad text", status: "done", archivedAt: "not-a-date" },
        { title: "Bad type", status: "done", archivedAt: 1750000000000 },
        {
          title: "Bad day",
          status: "done",
          archivedAt: "2026-13-99T00:00:00.000Z",
        },
      ],
      COLUMNS,
      [],
    );

    expect(plan.failures).toEqual([]);
    for (const task of plan.tasks) {
      expect(task.archivedAt).toBeUndefined();
      expect(task.warnings.some((warning) => /archivedAt/i.test(warning))).toBe(
        true,
      );
    }
  });
});
