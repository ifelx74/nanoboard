import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { isPageColorKey } from "../pages/colors";
import { extractContentText, extractHeadings } from "../pages/document";
import { suggestProjectKey } from "../task-key";
import { DEFAULT_COLUMNS } from "./schema";
import { buildSeedRows, resetToSeed } from "./seed";
import {
  createTestDb,
  makePage,
  makePageAsset,
  makePageContent,
} from "./test-db";

function findNodes(
  node: JSONContent | undefined,
  predicate: (candidate: JSONContent) => boolean,
  out: JSONContent[] = [],
): JSONContent[] {
  if (!node) return out;
  if (predicate(node)) out.push(node);
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      findNodes(child, predicate, out);
    }
  }
  return out;
}

describe("demo seed rows", () => {
  it("builds an internally consistent demo workspace including 1 rich sample page per project", () => {
    const rows = buildSeedRows();

    expect(rows.projects).toHaveLength(2);
    expect(rows.columns).toHaveLength(10);
    expect(rows.tasks).toHaveLength(9);
    expect(rows.labels).toHaveLength(7);
    expect(rows.taskLabels).toHaveLength(6);
    expect(rows.pages).toHaveLength(2);
    expect(rows.pageContents).toHaveLength(2);

    const projectIds = new Set(rows.projects.map((p) => p.id));
    const columnIds = new Set(rows.columns.map((c) => c.id));
    const taskIds = new Set(rows.tasks.map((t) => t.id));
    const labelIds = new Set(rows.labels.map((l) => l.id));
    const pageById = new Map(rows.pages.map((p) => [p.id, p]));

    for (const column of rows.columns) {
      expect(projectIds.has(column.projectId)).toBe(true);
    }
    for (const task of rows.tasks) {
      expect(projectIds.has(task.projectId)).toBe(true);
      expect(columnIds.has(task.columnId)).toBe(true);
    }
    for (const label of rows.labels) {
      expect(projectIds.has(label.projectId)).toBe(true);
    }
    for (const join of rows.taskLabels) {
      expect(taskIds.has(join.taskId)).toBe(true);
      expect(labelIds.has(join.labelId)).toBe(true);
    }

    // Exactly 1 active, unlocked sample page per demo project.
    for (const project of rows.projects) {
      const projectPages = rows.pages.filter((p) => p.projectId === project.id);
      expect(projectPages).toHaveLength(1);
      const page = projectPages[0]!;
      expect(page.title.trim().length).toBeGreaterThan(0);
      expect(page.logo?.type).toBe("emoji");
      expect(page.isLocked).toBe(false);
      expect(page.archivedAt).toBeUndefined();
    }

    // Every page has a 1-to-1 rich PageContent showcasing headings (H1–H3),
    // a callout, a task checklist, a standard table, and a TypeScript code block.
    for (const content of rows.pageContents) {
      const page = pageById.get(content.pageId);
      expect(page).toBeDefined();
      expect(content.projectId).toBe(page!.projectId);
      expect(content.contentJson.type).toBe("doc");

      // Derived contentText matches extractContentText(contentJson).
      expect(content.contentText.length).toBeGreaterThan(0);
      expect(content.contentText).toBe(extractContentText(content.contentJson));

      // Top-level blocks carry unique stable IDs.
      const topBlocks = content.contentJson.content ?? [];
      expect(topBlocks.length).toBeGreaterThan(0);
      const blockIds = topBlocks.map((block) => block.attrs?.id);
      for (const blockId of blockIds) {
        expect(typeof blockId).toBe("string");
        expect((blockId as string).length).toBeGreaterThan(0);
      }
      expect(new Set(blockIds).size).toBe(blockIds.length);

      // Headings H1, H2, and H3 are present in the outline.
      const headings = extractHeadings(content.contentJson);
      const levels = new Set(headings.map((h) => h.level));
      expect(levels.has(1)).toBe(true);
      expect(levels.has(2)).toBe(true);
      expect(levels.has(3)).toBe(true);

      // Callout node follows the editor's persisted attribute contract.
      const callouts = findNodes(
        content.contentJson,
        (n) => n.type === "callout",
      );
      expect(callouts.length).toBeGreaterThanOrEqual(1);
      const calloutAttrs = callouts[0]!.attrs ?? {};
      expect(calloutAttrs.logoType).toBe("emoji");
      expect(typeof calloutAttrs.emoji).toBe("string");
      expect((calloutAttrs.emoji as string).length).toBeGreaterThan(0);
      expect(calloutAttrs.iconName).toBeNull();
      expect(calloutAttrs.iconColor).toBeNull();
      expect(isPageColorKey(calloutAttrs.backgroundColor)).toBe(true);

      // Task checklist contains checked and unchecked taskItem nodes.
      const taskLists = findNodes(
        content.contentJson,
        (n) => n.type === "taskList",
      );
      expect(taskLists.length).toBeGreaterThanOrEqual(1);
      const taskItems = findNodes(taskLists[0], (n) => n.type === "taskItem");
      expect(taskItems.some((item) => item.attrs?.checked === true)).toBe(true);
      expect(taskItems.some((item) => item.attrs?.checked === false)).toBe(
        true,
      );

      // Standard TipTap table with header and data cells.
      const tables = findNodes(content.contentJson, (n) => n.type === "table");
      expect(tables.length).toBeGreaterThanOrEqual(1);
      expect(
        findNodes(tables[0], (n) => n.type === "tableRow").length,
      ).toBeGreaterThanOrEqual(2);
      expect(
        findNodes(tables[0], (n) => n.type === "tableHeader").length,
      ).toBeGreaterThanOrEqual(2);
      expect(
        findNodes(tables[0], (n) => n.type === "tableCell").length,
      ).toBeGreaterThanOrEqual(2);

      // Syntax-highlighted TypeScript code block.
      const codeBlocks = findNodes(
        content.contentJson,
        (n) => n.type === "codeBlock",
      );
      expect(codeBlocks.length).toBeGreaterThanOrEqual(1);
      expect(codeBlocks[0]!.attrs?.language).toBe("typescript");
      expect(extractContentText(codeBlocks[0]!).length).toBeGreaterThan(0);
    }

    // Rows look app-created: derived keys, DEFAULT_COLUMNS board, and ids
    // unique across every table.
    for (const project of rows.projects) {
      expect(project.slug).toBe(suggestProjectKey(project.name));
      expect(project.lastTaskNumber).toBe(
        rows.tasks.filter((task) => task.projectId === project.id).length,
      );
    }
    for (const project of rows.projects) {
      const slugs = rows.columns
        .filter((column) => column.projectId === project.id)
        .map((column) => column.slug);
      expect(slugs).toEqual(DEFAULT_COLUMNS.map((def) => def.slug));
    }
    const ids = [
      ...rows.projects,
      ...rows.columns,
      ...rows.tasks,
      ...rows.labels,
      ...rows.pages,
    ].map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resetToSeed fills an empty database and atomically clears and reseeds pages, contents, and assets", async () => {
    // Tests register no populate seeding, so a fresh database starts empty
    // and everything resetToSeed writes is its own.
    const db = createTestDb();
    await resetToSeed(db);

    const rows = buildSeedRows();
    expect(await db.projects.count()).toBe(rows.projects.length);
    expect(await db.columns.count()).toBe(rows.columns.length);
    expect(await db.tasks.count()).toBe(rows.tasks.length);
    expect(await db.labels.count()).toBe(rows.labels.length);
    expect(await db.taskLabels.count()).toBe(rows.taskLabels.length);
    expect(await db.pages.count()).toBe(rows.pages.length);
    expect(await db.pageContents.count()).toBe(rows.pageContents.length);
    expect(await db.pageAssets.count()).toBe(0);

    // Add extra user page, content, and binary asset rows — resetToSeed must
    // wipe all three page tables and reseed cleanly without leaving leftovers.
    await db.pages.add(
      makePage({ id: "user-page", projectId: "user-project", title: "Custom" }),
    );
    await db.pageContents.add(
      makePageContent({
        pageId: "user-page",
        projectId: "user-project",
        contentText: "Custom body",
      }),
    );
    await db.pageAssets.add(
      makePageAsset({
        id: "user-asset",
        pageId: "user-page",
        projectId: "user-project",
      }),
    );

    // A reset on a non-empty database replaces rather than duplicates.
    await resetToSeed(db);
    expect(await db.tasks.count()).toBe(rows.tasks.length);
    expect(await db.pages.count()).toBe(rows.pages.length);
    expect(await db.pageContents.count()).toBe(rows.pageContents.length);
    expect(await db.pageAssets.count()).toBe(0);
    expect(await db.pages.get("user-page")).toBeUndefined();
    expect(await db.pageContents.get("user-page")).toBeUndefined();
    expect(await db.pageAssets.get("user-asset")).toBeUndefined();

    await db.close();
  });
});
