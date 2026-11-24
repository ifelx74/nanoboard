import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NanoboardDB } from "./db";
import {
  createSticky,
  deleteSticky,
  EmptyStickyExistsError,
  getStickies,
  isStickyEmpty,
  reorderStickies,
  stickySearchIndex,
  updateSticky,
} from "./stickies";
import { createTestDb, makeSticky } from "./test-db";

describe("stickies persistence on fake-indexeddb", () => {
  let db: NanoboardDB;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  it("creates stickies at decreasing positions and blocks creating a second empty newest sticky", async () => {
    const first = await createSticky(db);
    expect(first.position).toBe(-1000);
    expect(isStickyEmpty(first.contentHtml)).toBe(true);

    await expect(createSticky(db)).rejects.toBeInstanceOf(
      EmptyStickyExistsError,
    );

    await updateSticky(db, first.id, { contentHtml: "<p>Groceries</p>" });
    const second = await createSticky(db);
    expect(second.position).toBe(-2000);

    const ordered = await getStickies(db);
    expect(ordered.map((s) => s.id)).toEqual([second.id, first.id]);

    const index = stickySearchIndex(ordered);
    expect(index.get(first.id)).toContain("groceries");

    await deleteSticky(db, first.id);
    expect((await getStickies(db)).map((s) => s.id)).toEqual([second.id]);
  });

  it("reorders stickies via midpoint seating and falls back to uniform re-indexing when gaps collapse", async () => {
    await db.stickies.bulkAdd([
      makeSticky({ id: "s1", position: 0 }),
      makeSticky({ id: "s2", position: 1000 }),
      makeSticky({ id: "s3", position: 2000 }),
    ]);

    // Move s3 before s2 -> seats at midpoint 500.
    await reorderStickies(db, "s3", "s2");
    expect((await getStickies(db)).map((s) => [s.id, s.position])).toEqual([
      ["s1", 0],
      ["s3", 500],
      ["s2", 1000],
    ]);

    // Collapse the gap below 1 to trigger uniform 1000-step re-index.
    await db.stickies.bulkPut([
      makeSticky({ id: "s1", position: 0 }),
      makeSticky({ id: "s2", position: 0.5 }),
      makeSticky({ id: "s3", position: 1 }),
    ]);
    await reorderStickies(db, "s3", "s2");
    expect((await getStickies(db)).map((s) => [s.id, s.position])).toEqual([
      ["s1", 0],
      ["s3", 1000],
      ["s2", 2000],
    ]);
  });
});
