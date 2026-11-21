import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NanoboardDB } from "./db";
import { deleteProject } from "./projects";
import {
  archivePage,
  createPage,
  deletePage,
  duplicatePage,
  getPage,
  getPageWithContent,
  isPageArchived,
  listProjectPageContentTexts,
  listProjectPages,
  restorePage,
  savePageContent,
  setPageFavorite,
  setPageLocked,
  updatePageTitle,
} from "./pages";
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

describe("Dexie v8 Pages schema on fake-indexeddb", () => {
  it("opens v8 with empty pages, pageContents, and pageAssets stores and enforces primary keys", async () => {
    const db = createTestDb();
    await db.open();

    expect(db.verno).toBe(8);
    expect(await db.pages.count()).toBe(0);
    expect(await db.pageContents.count()).toBe(0);
    expect(await db.pageAssets.count()).toBe(0);

    const page = makePage({ id: "page-1", projectId: "project-1" });
    await db.pages.add(page);
    await expect(db.pages.add(page)).rejects.toThrow();

    const content = makePageContent({
      pageId: "page-1",
      projectId: "project-1",
    });
    await db.pageContents.add(content);
    await expect(db.pageContents.add(content)).rejects.toThrow();

    const asset = makePageAsset({
      id: "asset-1",
      pageId: "page-1",
      projectId: "project-1",
    });
    await db.pageAssets.add(asset);
    await expect(db.pageAssets.add(asset)).rejects.toThrow();

    await db.close();
  });

  it("upgrades an existing v7 database cleanly with existing rows intact and empty page stores", async () => {
    const dbName = "nanoboard-v7-upgrade-test";
    const legacy = new Dexie(dbName);
    legacy.version(7).stores({
      projects: "&id, slug, position",
      columns: "&id, projectId, [projectId+position]",
      tasks:
        "&id, projectId, columnId, status, dueDate, [projectId+columnId+position], &[projectId+number]",
      labels: "&id, projectId, &[projectId+name]",
      taskLabels: "&[taskId+labelId], taskId, labelId",
      taskResources: "&id, taskId",
      stickies: "&id, position, createdAt, updatedAt",
      whiteboards: "&id, projectId, &[projectId]",
      whiteboardPreviews: "&projectId, updatedAt",
    });
    await legacy.open();
    await legacy.table("projects").add(
      makeProject({
        id: "legacy-project",
        name: "Legacy",
        slug: "LG",
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
      }),
    );
    legacy.close();

    const upgraded = new NanoboardDB(dbName);
    await upgraded.open();

    expect(upgraded.verno).toBe(8);
    expect(await upgraded.projects.get("legacy-project")).toMatchObject({
      id: "legacy-project",
      name: "Legacy",
    });
    expect(await upgraded.pages.count()).toBe(0);
    expect(await upgraded.pageContents.count()).toBe(0);
    expect(await upgraded.pageAssets.count()).toBe(0);

    await upgraded.close();
    await Dexie.delete(dbName);
  });
});

describe("Pages data layer CRUD on fake-indexeddb", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createPage atomically writes pages metadata and empty pageContents", async () => {
    const db = createTestDb();
    await seedTestDb(db);
    vi.spyOn(Date, "now").mockReturnValue(TEST_NOW);

    const pageId = await createPage(db, "project-1");

    const metadata = await getPage(db, pageId);
    expect(metadata).toEqual({
      id: pageId,
      projectId: "project-1",
      title: "",
      logo: null,
      isFavorite: false,
      isLocked: false,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
    });

    const loaded = await getPageWithContent(db, pageId, "project-1");
    expect(loaded).toEqual({
      page: metadata,
      content: {
        pageId,
        projectId: "project-1",
        contentJson: { type: "doc", content: [{ type: "paragraph" }] },
        contentText: "",
      },
    });

    await db.close();
  });

  it("createPage accepts optional title, logo, and initial contentJson with derived contentText", async () => {
    const db = createTestDb();
    await seedTestDb(db);
    vi.spyOn(Date, "now").mockReturnValue(TEST_NOW);

    const pageId = await createPage(db, "project-1", {
      title: "Architecture",
      logo: { type: "emoji", value: "🧭" },
      contentJson: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Overview" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Local-first storage." }],
          },
        ],
      },
    });

    const loaded = await getPageWithContent(db, pageId);
    expect(loaded?.page.title).toBe("Architecture");
    expect(loaded?.page.logo).toEqual({ type: "emoji", value: "🧭" });
    expect(loaded?.content.contentText).toBe("Overview\nLocal-first storage.");

    await db.close();
  });

  it("getPageWithContent returns undefined for missing or cross-project page IDs", async () => {
    const db = createTestDb();
    await seedTestDb(db, {
      ...buildTestContents(),
      projects: [
        makeProject({ id: "project-1" }),
        makeProject({ id: "project-2", slug: "P2", name: "Other" }),
      ],
    });

    const pageId = await createPage(db, "project-1", { title: "Scoped" });

    expect(await getPageWithContent(db, "missing-page")).toBeUndefined();
    expect(await getPageWithContent(db, pageId, "project-2")).toBeUndefined();
    expect(await getPageWithContent(db, pageId, "project-1")).toBeDefined();

    await db.close();
  });

  it("listProjectPages returns only metadata for the target project ordered by updatedAt desc without reading pageContents", async () => {
    const db = createTestDb();
    await seedTestDb(db, {
      ...buildTestContents(),
      projects: [
        makeProject({ id: "project-1" }),
        makeProject({ id: "project-2", slug: "P2", name: "Other" }),
      ],
      pages: [
        makePage({
          id: "p-old",
          projectId: "project-1",
          title: "Older",
          updatedAt: TEST_NOW,
        }),
        makePage({
          id: "p-new",
          projectId: "project-1",
          title: "Newer",
          updatedAt: TEST_NOW + 5_000,
        }),
        makePage({
          id: "p-other",
          projectId: "project-2",
          title: "Other project",
          updatedAt: TEST_NOW + 10_000,
        }),
      ],
      // Deliberately omit pageContents rows to prove listProjectPages never
      // depends on or loads document bodies.
      pageContents: [],
    });

    const pages = await listProjectPages(db, "project-1");

    expect(pages.map((page) => page.id)).toEqual(["p-new", "p-old"]);
    for (const page of pages) {
      expect("contentJson" in page).toBe(false);
      expect("contentText" in page).toBe(false);
    }

    await db.close();
  });

  it("updatePageTitle updates the title and bumps updatedAt without touching content", async () => {
    const db = createTestDb();
    await seedTestDb(db);
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(TEST_NOW);

    const pageId = await createPage(db, "project-1", {
      title: "Draft",
      contentJson: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Body" }] },
        ],
      },
    });

    now.mockReturnValue(TEST_NOW + 2_000);
    await updatePageTitle(db, pageId, "Published Spec");

    const loaded = await getPageWithContent(db, pageId);
    expect(loaded?.page.title).toBe("Published Spec");
    expect(loaded?.page.createdAt).toBe(TEST_NOW);
    expect(loaded?.page.updatedAt).toBe(TEST_NOW + 2_000);
    expect(loaded?.content.contentText).toBe("Body");

    await expect(updatePageTitle(db, "missing-page", "Nope")).rejects.toThrow(
      "Page not found.",
    );

    await db.close();
  });

  it("savePageContent persists contentJson, derives contentText, and advances updatedAt atomically", async () => {
    const db = createTestDb();
    await seedTestDb(db);
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(TEST_NOW);

    const pageId = await createPage(db, "project-1", { title: "Runbook" });

    const nextDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Checklist" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Verify backups." }],
        },
      ],
    };

    now.mockReturnValue(TEST_NOW + 4_500);
    await savePageContent(db, pageId, nextDoc);

    const loaded = await getPageWithContent(db, pageId);
    expect(loaded?.content.contentJson).toEqual(nextDoc);
    expect(loaded?.content.contentText).toBe("Checklist\nVerify backups.");
    expect(loaded?.page.updatedAt).toBe(TEST_NOW + 4_500);

    await expect(savePageContent(db, "missing-page", nextDoc)).rejects.toThrow(
      "Page not found.",
    );

    await db.close();
  });
});

describe("deleteProject Pages cascade on fake-indexeddb", () => {
  it("atomically removes all pages, pageContents, and pageAssets for the deleted project while keeping other projects intact", async () => {
    const db = createTestDb();
    await seedTestDb(db, {
      ...buildTestContents(),
      projects: [
        makeProject({ id: "project-1", name: "Do delete", slug: "DD" }),
        makeProject({ id: "project-2", name: "Keep me", slug: "KM" }),
      ],
      pages: [
        makePage({ id: "page-1", projectId: "project-1", title: "Spec" }),
        makePage({ id: "page-2", projectId: "project-1", title: "Notes" }),
        makePage({ id: "page-keep", projectId: "project-2", title: "Keep" }),
      ],
      pageContents: [
        makePageContent({
          pageId: "page-1",
          projectId: "project-1",
          contentText: "Spec body",
        }),
        makePageContent({
          pageId: "page-2",
          projectId: "project-1",
          contentText: "Notes body",
        }),
        makePageContent({
          pageId: "page-keep",
          projectId: "project-2",
          contentText: "Keep body",
        }),
      ],
      pageAssets: [
        makePageAsset({
          id: "asset-1",
          pageId: "page-1",
          projectId: "project-1",
        }),
        makePageAsset({
          id: "asset-2",
          pageId: "page-2",
          projectId: "project-1",
        }),
        makePageAsset({
          id: "asset-keep",
          pageId: "page-keep",
          projectId: "project-2",
        }),
      ],
    });

    await deleteProject(db, "project-1");

    expect(await db.projects.get("project-1")).toBeUndefined();
    expect(await db.pages.where("projectId").equals("project-1").count()).toBe(
      0,
    );
    expect(
      await db.pageContents.where("projectId").equals("project-1").count(),
    ).toBe(0);
    expect(
      await db.pageAssets.where("projectId").equals("project-1").count(),
    ).toBe(0);

    // Other project's page metadata, content, and assets remain untouched.
    expect(await getPage(db, "page-keep")).toBeDefined();
    expect(await db.pageContents.get("page-keep")).toBeDefined();
    expect(await db.pageAssets.get("asset-keep")).toBeDefined();

    await db.close();
  });
});

describe("Pages lifecycle operations on fake-indexeddb", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("archivePage stamps archivedAt and updatedAt, is idempotent, and restorePage clears archivedAt", async () => {
    const db = createTestDb();
    await seedTestDb(db);
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(TEST_NOW);

    const pageId = await createPage(db, "project-1", { title: "Spec" });
    const initial = await getPage(db, pageId);
    expect(initial && isPageArchived(initial)).toBe(false);

    now.mockReturnValue(TEST_NOW + 1_000);
    await archivePage(db, pageId);

    const archived = await getPage(db, pageId);
    expect(archived?.archivedAt).toBe(TEST_NOW + 1_000);
    expect(archived?.updatedAt).toBe(TEST_NOW + 1_000);
    expect(archived && isPageArchived(archived)).toBe(true);

    // Archiving an already-archived page is an idempotent no-op.
    now.mockReturnValue(TEST_NOW + 2_000);
    await archivePage(db, pageId);
    expect((await getPage(db, pageId))?.archivedAt).toBe(TEST_NOW + 1_000);

    // Restoring removes archivedAt and bumps updatedAt.
    now.mockReturnValue(TEST_NOW + 3_000);
    await restorePage(db, pageId);

    const restored = await getPage(db, pageId);
    expect(restored?.archivedAt).toBeUndefined();
    expect("archivedAt" in (restored ?? {})).toBe(false);
    expect(restored?.updatedAt).toBe(TEST_NOW + 3_000);
    expect(restored && isPageArchived(restored)).toBe(false);

    // Restoring an already-active page is a no-op.
    now.mockReturnValue(TEST_NOW + 4_000);
    await restorePage(db, pageId);
    expect((await getPage(db, pageId))?.updatedAt).toBe(TEST_NOW + 3_000);

    await expect(archivePage(db, "missing-page")).rejects.toThrow(
      "Page not found.",
    );
    await expect(restorePage(db, "missing-page")).rejects.toThrow(
      "Page not found.",
    );

    await db.close();
  });

  it("setPageLocked and setPageFavorite update flags, bump updatedAt, and reject missing pages", async () => {
    const db = createTestDb();
    await seedTestDb(db);
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(TEST_NOW);

    const pageId = await createPage(db, "project-1", { title: "Guide" });

    now.mockReturnValue(TEST_NOW + 1_500);
    await setPageLocked(db, pageId, true);
    let page = await getPage(db, pageId);
    expect(page?.isLocked).toBe(true);
    expect(page?.updatedAt).toBe(TEST_NOW + 1_500);

    now.mockReturnValue(TEST_NOW + 2_500);
    await setPageLocked(db, pageId, false);
    page = await getPage(db, pageId);
    expect(page?.isLocked).toBe(false);
    expect(page?.updatedAt).toBe(TEST_NOW + 2_500);

    now.mockReturnValue(TEST_NOW + 3_500);
    await setPageFavorite(db, pageId, true);
    page = await getPage(db, pageId);
    expect(page?.isFavorite).toBe(true);
    expect(page?.updatedAt).toBe(TEST_NOW + 3_500);

    now.mockReturnValue(TEST_NOW + 4_500);
    await setPageFavorite(db, pageId, false);
    page = await getPage(db, pageId);
    expect(page?.isFavorite).toBe(false);
    expect(page?.updatedAt).toBe(TEST_NOW + 4_500);

    await expect(setPageLocked(db, "missing-page", true)).rejects.toThrow(
      "Page not found.",
    );
    await expect(setPageFavorite(db, "missing-page", true)).rejects.toThrow(
      "Page not found.",
    );

    await db.close();
  });

  it("deletePage rejects active or missing pages without deleting any rows and atomically cascades across pages, pageContents, and pageAssets once archived", async () => {
    const db = createTestDb();
    await seedTestDb(db, {
      ...buildTestContents(),
      pages: [
        makePage({
          id: "page-active",
          projectId: "project-1",
          title: "Active",
        }),
        makePage({
          id: "page-archived",
          projectId: "project-1",
          title: "Old",
          archivedAt: TEST_NOW,
        }),
        makePage({
          id: "page-sibling",
          projectId: "project-1",
          title: "Sibling",
          archivedAt: TEST_NOW,
        }),
      ],
      pageContents: [
        makePageContent({
          pageId: "page-active",
          projectId: "project-1",
          contentText: "Active body",
        }),
        makePageContent({
          pageId: "page-archived",
          projectId: "project-1",
          contentText: "Archived body",
        }),
        makePageContent({
          pageId: "page-sibling",
          projectId: "project-1",
          contentText: "Sibling body",
        }),
      ],
      pageAssets: [
        makePageAsset({
          id: "asset-active",
          pageId: "page-active",
          projectId: "project-1",
        }),
        makePageAsset({
          id: "asset-archived-1",
          pageId: "page-archived",
          projectId: "project-1",
        }),
        makePageAsset({
          id: "asset-archived-2",
          pageId: "page-archived",
          projectId: "project-1",
        }),
        makePageAsset({
          id: "asset-sibling",
          pageId: "page-sibling",
          projectId: "project-1",
        }),
      ],
    });

    await expect(deletePage(db, "missing-page")).rejects.toThrow(
      "Page not found.",
    );
    await expect(deletePage(db, "page-active")).rejects.toThrow(
      "Only archived pages can be deleted.",
    );

    // Active page and its content/asset remain untouched.
    expect(await getPage(db, "page-active")).toBeDefined();
    expect(await db.pageContents.get("page-active")).toBeDefined();
    expect(await db.pageAssets.get("asset-active")).toBeDefined();

    // Archived page deletes cleanly across all three tables.
    await deletePage(db, "page-archived");
    expect(await getPage(db, "page-archived")).toBeUndefined();
    expect(await db.pageContents.get("page-archived")).toBeUndefined();
    expect(
      await db.pageAssets.where("pageId").equals("page-archived").count(),
    ).toBe(0);

    // Sibling page and assets remain intact.
    expect(await getPage(db, "page-sibling")).toBeDefined();
    expect(await db.pageContents.get("page-sibling")).toBeDefined();
    expect(await db.pageAssets.get("asset-sibling")).toBeDefined();

    await db.close();
  });

  it("duplicatePage clones metadata, rewrites local assetIds, clones referenced pageAssets with fresh IDs, clears lock/archive state, and isolates deletes", async () => {
    const db = createTestDb();
    const asset1Blob = new Blob(["image-one-bytes"], { type: "image/png" });
    const asset2Blob = new Blob(["image-two-bytes"], { type: "image/webp" });
    const orphanBlob = new Blob(["orphan-bytes"], { type: "image/png" });

    await seedTestDb(db, {
      ...buildTestContents(),
      pages: [
        makePage({
          id: "source-page",
          projectId: "project-1",
          title: "Architecture",
          logo: { type: "icon", name: "Layers", color: "#3e77fd" },
          isFavorite: true,
          isLocked: true,
          archivedAt: TEST_NOW,
          createdAt: TEST_NOW,
          updatedAt: TEST_NOW,
        }),
      ],
      pageContents: [
        makePageContent({
          pageId: "source-page",
          projectId: "project-1",
          contentJson: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "System diagram" }],
              },
              {
                type: "image",
                attrs: { assetId: "src-asset-1", width: "50%" },
              },
              {
                type: "callout",
                content: [
                  {
                    type: "image",
                    attrs: { assetId: "src-asset-1", alt: "Repeated" },
                  },
                  {
                    type: "image",
                    attrs: { assetId: "src-asset-2", alignment: "center" },
                  },
                  {
                    type: "image",
                    attrs: { src: "https://example.com/ext.png" },
                  },
                ],
              },
            ],
          },
          contentText: "System diagram",
        }),
      ],
      pageAssets: [
        makePageAsset({
          id: "src-asset-1",
          pageId: "source-page",
          projectId: "project-1",
          name: "arch.png",
          mimeType: "image/png",
          size: asset1Blob.size,
          blob: asset1Blob,
        }),
        makePageAsset({
          id: "src-asset-2",
          pageId: "source-page",
          projectId: "project-1",
          name: "flow.webp",
          mimeType: "image/webp",
          size: asset2Blob.size,
          blob: asset2Blob,
        }),
        makePageAsset({
          id: "src-orphan",
          pageId: "source-page",
          projectId: "project-1",
          name: "unused.png",
          mimeType: "image/png",
          size: orphanBlob.size,
          blob: orphanBlob,
        }),
      ],
    });

    vi.spyOn(Date, "now").mockReturnValue(TEST_NOW + 9_000);
    const copyId = await duplicatePage(db, "source-page");

    expect(copyId).not.toBe("source-page");

    const copy = await getPageWithContent(db, copyId, "project-1");
    expect(copy?.page).toEqual({
      id: copyId,
      projectId: "project-1",
      title: "Architecture (Copy)",
      logo: { type: "icon", name: "Layers", color: "#3e77fd" },
      isFavorite: false,
      isLocked: false,
      createdAt: TEST_NOW + 9_000,
      updatedAt: TEST_NOW + 9_000,
    });
    expect("archivedAt" in (copy?.page ?? {})).toBe(false);
    expect(copy?.content.contentText).toBe("System diagram");

    const copyAssets = await db.pageAssets
      .where("pageId")
      .equals(copyId)
      .toArray();
    // Only the 2 referenced assets were cloned (orphan was excluded).
    expect(copyAssets).toHaveLength(2);
    const copyAssetIds = new Set(copyAssets.map((a) => a.id));
    expect(copyAssetIds.has("src-asset-1")).toBe(false);
    expect(copyAssetIds.has("src-asset-2")).toBe(false);

    const clonedTopImgId = copy?.content.contentJson.content?.[1]?.attrs
      ?.assetId as string;
    const clonedRepeatImgId = copy?.content.contentJson.content?.[2]
      ?.content?.[0]?.attrs?.assetId as string;
    const clonedSecondImgId = copy?.content.contentJson.content?.[2]
      ?.content?.[1]?.attrs?.assetId as string;
    const clonedExtSrc =
      copy?.content.contentJson.content?.[2]?.content?.[2]?.attrs?.src;

    expect(copyAssetIds.has(clonedTopImgId)).toBe(true);
    expect(clonedRepeatImgId).toBe(clonedTopImgId);
    expect(copyAssetIds.has(clonedSecondImgId)).toBe(true);
    expect(clonedSecondImgId).not.toBe(clonedTopImgId);
    expect(clonedExtSrc).toBe("https://example.com/ext.png");

    const clonedArchAsset = copyAssets.find((a) => a.id === clonedTopImgId);
    expect(clonedArchAsset?.name).toBe("arch.png");
    expect(clonedArchAsset?.mimeType).toBe("image/png");
    expect(await clonedArchAsset?.blob.text()).toBe("image-one-bytes");

    // Archiving and deleting the duplicate must never disturb the original page or its assets.
    await archivePage(db, copyId);
    await deletePage(db, copyId);

    const original = await getPageWithContent(db, "source-page", "project-1");
    expect(original?.content.contentJson.content?.[1]?.attrs?.assetId).toBe(
      "src-asset-1",
    );
    expect(await db.pageAssets.get("src-asset-1")).toBeDefined();
    expect(await db.pageAssets.get("src-asset-2")).toBeDefined();

    // Custom title override and missing-page rejection.
    const localizedCopyId = await duplicatePage(db, "source-page", {
      title: "Architecture (copie)",
    });
    expect((await getPage(db, localizedCopyId))?.title).toBe(
      "Architecture (copie)",
    );

    const untitledId = await createPage(db, "project-1");
    const untitledCopyId = await duplicatePage(db, untitledId);
    expect((await getPage(db, untitledCopyId))?.title).toBe("Untitled (Copy)");

    await expect(duplicatePage(db, "missing-page")).rejects.toThrow(
      "Page not found.",
    );

    await db.close();
  });

  it("listProjectPageContentTexts returns pageId-to-contentText map scoped strictly to the target project", async () => {
    const db = createTestDb();
    await seedTestDb(db, {
      ...buildTestContents(),
      projects: [
        makeProject({ id: "project-1" }),
        makeProject({ id: "project-2", slug: "P2", name: "Other" }),
      ],
      pages: [
        makePage({ id: "p1", projectId: "project-1", title: "Spec" }),
        makePage({ id: "p2", projectId: "project-1", title: "Notes" }),
        makePage({ id: "p3", projectId: "project-2", title: "Other" }),
      ],
      pageContents: [
        makePageContent({
          pageId: "p1",
          projectId: "project-1",
          contentText: "IndexedDB offline engine",
        }),
        makePageContent({
          pageId: "p2",
          projectId: "project-1",
          contentText: "Sprint checklist",
        }),
        makePageContent({
          pageId: "p3",
          projectId: "project-2",
          contentText: "Unrelated project content",
        }),
      ],
    });

    const texts = await listProjectPageContentTexts(db, "project-1");

    expect(texts).toEqual(
      new Map([
        ["p1", "IndexedDB offline engine"],
        ["p2", "Sprint checklist"],
      ]),
    );

    await db.close();
  });
});
