import { describe, expect, it, vi } from "vitest";
import {
  createPage,
  duplicatePage,
  getPageWithContent,
  savePageContent,
  updatePageTitle,
} from "../db/pages";
import { createTestDb } from "../db/test-db";
import { createDebouncedSaver } from "./autosave-flush";

describe("createDebouncedSaver", () => {
  it("flushes pending debounced title and content edits before duplicating a page", async () => {
    const db = createTestDb();
    const pageId = await createPage(db, "project-1", {
      title: "Original Title",
      contentJson: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Old body" }] },
        ],
      },
    });

    const liveTitle = "Edited Before Debounce";
    const liveBody = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Fresh unsaved paragraph" }],
        },
      ],
    };

    const titleSaver = createDebouncedSaver({
      delayMs: 5_000,
      save: () => updatePageTitle(db, pageId, liveTitle),
    });
    const contentSaver = createDebouncedSaver({
      delayMs: 5_000,
      save: () => savePageContent(db, pageId, liveBody),
    });

    // User types title & body and immediately clicks "Make a copy" well inside
    // the debounce window.
    titleSaver.schedule();
    contentSaver.schedule();

    await Promise.all([titleSaver.flush(), contentSaver.flush()]);

    const copyId = await duplicatePage(db, pageId, {
      title: `${liveTitle} (copy)`,
    });

    const original = await getPageWithContent(db, pageId);
    const copy = await getPageWithContent(db, copyId);

    expect(original?.page.title).toBe("Edited Before Debounce");
    expect(original?.content.contentText).toBe("Fresh unsaved paragraph");
    expect(copy?.page.title).toBe("Edited Before Debounce (copy)");
    expect(copy?.content.contentText).toBe("Fresh unsaved paragraph");

    await db.close();
  });

  it("awaits an in-flight save even when flush is called after dirty was already cleared", async () => {
    let resolveSave: (() => void) | null = null;
    let completed = false;

    const saver = createDebouncedSaver({
      delayMs: 5_000,
      save: () =>
        new Promise<void>((resolve) => {
          resolveSave = () => {
            completed = true;
            resolve();
          };
        }),
    });

    saver.schedule();
    const firstFlush = saver.flush();
    const secondFlush = saver.flush();

    expect(completed).toBe(false);
    resolveSave!();
    await expect(secondFlush).resolves.toBe(true);
    await expect(firstFlush).resolves.toBe(true);
    expect(completed).toBe(true);
  });

  it("serializes overlapping edits so a newer edit never races ahead of an earlier write", async () => {
    const written: string[] = [];
    let releaseFirst: (() => void) | null = null;
    let current = "v1";

    const saver = createDebouncedSaver({
      delayMs: 5_000,
      save: async () => {
        const snapshot = current;
        if (snapshot === "v1") {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
        }
        written.push(snapshot);
      },
    });

    saver.schedule();
    const first = saver.flush();

    current = "v2";
    saver.schedule();
    const second = saver.flush();

    releaseFirst!();
    await Promise.all([first, second]);

    expect(written).toEqual(["v1", "v2"]);
  });

  it("re-marks dirty and reports errors when save fails so a subsequent flush retries", async () => {
    let attempts = 0;
    const onError = vi.fn();

    const saver = createDebouncedSaver({
      delayMs: 5_000,
      save: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("Quota exceeded");
        }
      },
      onError,
    });

    saver.schedule();
    await expect(saver.flush()).resolves.toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);

    await expect(saver.flush()).resolves.toBe(true);
    expect(attempts).toBe(2);
  });
});
