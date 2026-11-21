import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NanoboardDB } from "./db";
import { deleteProject } from "./projects";
import {
  createPage,
  getPage,
  getPageWithContent,
  listProjectPages,
  savePageContent,
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
    expect(
      await getPageWithContent(db, pageId, "project-2"),
    ).toBeUndefined();
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

    await expect(
      savePageContent(db, "missing-page", nextDoc),
    ).rejects.toThrow("Page not found.");

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
    expect(
      await db.pages.where("projectId").equals("project-1").count(),
    ).toBe(0);
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
