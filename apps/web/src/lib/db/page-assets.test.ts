import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PAGE_IMAGE_MAX_BYTES,
  PageImageValidationError,
} from "../pages/image-upload";
import {
  getPageAsset,
  getPageAssets,
  pruneOrphanPageAssets,
  savePageAsset,
} from "./page-assets";
import { savePageContent } from "./pages";
import {
  buildTestContents,
  createTestDb,
  makePage,
  makePageAsset,
  makePageContent,
  makeProject,
  seedTestDb,
  TEST_NOW,
} from "./test-db";

describe("pageAssets data layer on fake-indexeddb", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("savePageAsset validates MIME and 10 MB cap, persists blob metadata, and makes the asset retrievable via getPageAsset", async () => {
    const db = createTestDb();
    await seedTestDb(db, {
      ...buildTestContents(),
      pages: [makePage({ id: "page-1", projectId: "project-1" })],
      pageContents: [
        makePageContent({ pageId: "page-1", projectId: "project-1" }),
      ],
    });
    vi.spyOn(Date, "now").mockReturnValue(TEST_NOW + 500);

    const blob = new Blob(["webp-binary-data"], { type: "image/webp" });
    const saved = await savePageAsset(db, {
      pageId: "page-1",
      projectId: "project-1",
      name: "diagram.webp",
      mimeType: "image/webp",
      blob,
    });

    expect(saved.id).toBeTruthy();
    expect(saved.pageId).toBe("page-1");
    expect(saved.projectId).toBe("project-1");
    expect(saved.name).toBe("diagram.webp");
    expect(saved.mimeType).toBe("image/webp");
    expect(saved.size).toBe(blob.size);
    expect(saved.createdAt).toBe(TEST_NOW + 500);

    const fetched = await getPageAsset(db, saved.id);
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe("diagram.webp");
    expect(await fetched?.blob.text()).toBe("webp-binary-data");

    expect(await getPageAsset(db, "missing-asset")).toBeUndefined();

    await db.close();
  });

  it("savePageAsset rejects unsupported MIME types, >10 MB blobs, and missing or cross-project pages without writing rows", async () => {
    const db = createTestDb();
    await seedTestDb(db, {
      ...buildTestContents(),
      projects: [
        makeProject({ id: "project-1" }),
        makeProject({ id: "project-2", slug: "P2", name: "Other" }),
      ],
      pages: [makePage({ id: "page-1", projectId: "project-1" })],
      pageAssets: [],
    });

    await expect(
      savePageAsset(db, {
        pageId: "page-1",
        projectId: "project-1",
        name: "vector.svg",
        mimeType: "image/svg+xml",
        blob: new Blob(["<svg/>"], { type: "image/svg+xml" }),
      }),
    ).rejects.toMatchObject({
      name: "PageImageValidationError",
      code: "unsupported-type",
    });

    await expect(
      savePageAsset(db, {
        pageId: "page-1",
        projectId: "project-1",
        name: "oversize.png",
        mimeType: "image/png",
        blob: new Blob([new Uint8Array(PAGE_IMAGE_MAX_BYTES + 1)], {
          type: "image/png",
        }),
      }),
    ).rejects.toBeInstanceOf(PageImageValidationError);

    await expect(
      savePageAsset(db, {
        pageId: "missing-page",
        projectId: "project-1",
        name: "ok.png",
        mimeType: "image/png",
        blob: new Blob(["ok"], { type: "image/png" }),
      }),
    ).rejects.toThrow("Page not found.");

    await expect(
      savePageAsset(db, {
        pageId: "page-1",
        projectId: "project-2",
        name: "wrong-project.png",
        mimeType: "image/png",
        blob: new Blob(["ok"], { type: "image/png" }),
      }),
    ).rejects.toThrow("Page does not belong to project.");

    expect(await db.pageAssets.count()).toBe(0);

    await db.close();
  });

  it("getPageAssets returns only assets for the target page ordered by createdAt asc then id", async () => {
    const db = createTestDb();
    await seedTestDb(db, {
      ...buildTestContents(),
      pages: [
        makePage({ id: "page-1", projectId: "project-1" }),
        makePage({ id: "page-2", projectId: "project-1" }),
      ],
      pageAssets: [
        makePageAsset({
          id: "asset-late",
          pageId: "page-1",
          projectId: "project-1",
          name: "late.png",
          createdAt: TEST_NOW + 3000,
        }),
        makePageAsset({
          id: "asset-b",
          pageId: "page-1",
          projectId: "project-1",
          name: "b.png",
          createdAt: TEST_NOW + 1000,
        }),
        makePageAsset({
          id: "asset-a",
          pageId: "page-1",
          projectId: "project-1",
          name: "a.png",
          createdAt: TEST_NOW + 1000,
        }),
        makePageAsset({
          id: "asset-other-page",
          pageId: "page-2",
          projectId: "project-1",
          name: "other.png",
          createdAt: TEST_NOW,
        }),
      ],
    });

    const page1Assets = await getPageAssets(db, "page-1");
    expect(page1Assets.map((a) => a.id)).toEqual([
      "asset-a",
      "asset-b",
      "asset-late",
    ]);

    const page2Assets = await getPageAssets(db, "page-2");
    expect(page2Assets.map((a) => a.id)).toEqual(["asset-other-page"]);

    expect(await getPageAssets(db, "missing-page")).toEqual([]);

    await db.close();
  });

  it("pruneOrphanPageAssets retains referenced top-level and nested assets, evicts orphans for pageId, and never touches other pages", async () => {
    const db = createTestDb();
    await seedTestDb(db, {
      ...buildTestContents(),
      projects: [
        makeProject({ id: "project-1" }),
        makeProject({ id: "project-2", slug: "P2", name: "Other" }),
      ],
      pages: [
        makePage({ id: "page-1", projectId: "project-1" }),
        makePage({ id: "page-2", projectId: "project-1" }),
        makePage({ id: "page-other-project", projectId: "project-2" }),
      ],
      pageContents: [
        makePageContent({
          pageId: "page-1",
          projectId: "project-1",
          contentJson: {
            type: "doc",
            content: [
              { type: "image", attrs: { assetId: "asset-keep-top" } },
              {
                type: "callout",
                content: [
                  {
                    type: "image",
                    attrs: { assetId: "asset-keep-nested" },
                  },
                ],
              },
              {
                type: "image",
                attrs: { src: "https://example.com/external.png" },
              },
            ],
          },
        }),
        makePageContent({
          pageId: "page-2",
          projectId: "project-1",
          contentJson: { type: "doc", content: [{ type: "paragraph" }] },
        }),
        makePageContent({
          pageId: "page-other-project",
          projectId: "project-2",
          contentJson: { type: "doc", content: [{ type: "paragraph" }] },
        }),
      ],
      pageAssets: [
        makePageAsset({
          id: "asset-keep-top",
          pageId: "page-1",
          projectId: "project-1",
        }),
        makePageAsset({
          id: "asset-keep-nested",
          pageId: "page-1",
          projectId: "project-1",
        }),
        makePageAsset({
          id: "asset-orphan-1",
          pageId: "page-1",
          projectId: "project-1",
        }),
        makePageAsset({
          id: "asset-orphan-2",
          pageId: "page-1",
          projectId: "project-1",
        }),
        // Orphans belonging to OTHER pages must NOT be touched when pruning page-1.
        makePageAsset({
          id: "asset-page2-orphan",
          pageId: "page-2",
          projectId: "project-1",
        }),
        makePageAsset({
          id: "asset-other-project-orphan",
          pageId: "page-other-project",
          projectId: "project-2",
        }),
      ],
    });

    const removed = await pruneOrphanPageAssets(db, "page-1");
    expect(removed.sort()).toEqual(["asset-orphan-1", "asset-orphan-2"]);

    expect((await getPageAssets(db, "page-1")).map((a) => a.id).sort()).toEqual(
      ["asset-keep-nested", "asset-keep-top"],
    );
    expect(await getPageAsset(db, "asset-page2-orphan")).toBeDefined();
    expect(await getPageAsset(db, "asset-other-project-orphan")).toBeDefined();

    // Second run with no remaining orphans is a clean no-op.
    expect(await pruneOrphanPageAssets(db, "page-1")).toEqual([]);

    await db.close();
  });

  it("pruneOrphanPageAssets supports olderThan cutoff for defensive load pruning without deleting fresh in-session uploads", async () => {
    const db = createTestDb();
    await seedTestDb(db, {
      ...buildTestContents(),
      pages: [makePage({ id: "page-1", projectId: "project-1" })],
      pageContents: [
        makePageContent({
          pageId: "page-1",
          projectId: "project-1",
          contentJson: { type: "doc", content: [{ type: "paragraph" }] },
        }),
      ],
      pageAssets: [
        makePageAsset({
          id: "stale-orphan",
          pageId: "page-1",
          projectId: "project-1",
          createdAt: TEST_NOW - 5_000,
        }),
        makePageAsset({
          id: "fresh-upload-unsaved",
          pageId: "page-1",
          projectId: "project-1",
          createdAt: TEST_NOW + 100,
        }),
      ],
    });

    const prunedAtLoad = await pruneOrphanPageAssets(db, "page-1", {
      olderThan: TEST_NOW,
    });
    expect(prunedAtLoad).toEqual(["stale-orphan"]);
    expect(await getPageAsset(db, "fresh-upload-unsaved")).toBeDefined();

    // After saving updated content without the image and pruning on unmount (no cutoff),
    // the unreferenced asset is cleaned up cleanly.
    await savePageContent(db, "page-1", {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Done" }] },
      ],
    });
    const prunedAtUnmount = await pruneOrphanPageAssets(db, "page-1");
    expect(prunedAtUnmount).toEqual(["fresh-upload-unsaved"]);
    expect(await getPageAssets(db, "page-1")).toEqual([]);

    await db.close();
  });
});
