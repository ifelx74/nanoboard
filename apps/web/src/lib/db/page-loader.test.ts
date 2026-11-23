import { describe, expect, it } from "vitest";
import { getPageMeta } from "./page-loader";
import {
  buildTestContents,
  createTestDb,
  makePage,
  seedTestDb,
} from "./test-db";

describe("getPageMeta", () => {
  it("returns the page metadata row for an existing page", async () => {
    const db = createTestDb();
    const contents = buildTestContents();
    const page = makePage({ id: "page-meta-1", title: "Architecture Notes" });
    contents.pages.push(page);
    await seedTestDb(db, contents);

    const loaded = await getPageMeta(db, "page-meta-1");
    expect(loaded).toEqual(page);

    await db.close();
  });

  it("returns undefined for a missing page id", async () => {
    const db = createTestDb();
    await seedTestDb(db);

    const loaded = await getPageMeta(db, "page-does-not-exist");
    expect(loaded).toBeUndefined();

    await db.close();
  });
});
