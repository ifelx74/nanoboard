import { describe, expect, it } from "vitest";
import enUS from "./locales/en-US.json";

describe("stickies extraction (ticket 11)", () => {
  it("covers stickies chrome and action-bar copy", () => {
    const stickies = enUS.stickies as unknown as Record<
      string,
      Record<string, unknown>
    >;
    expect(stickies.title).toBe("Stickies");
    expect(stickies.addSticky).toBe("Add sticky");
    expect(stickies.all).toBe("All stickies");
    expect(stickies.recent).toBe("Recent sticky");
    expect(stickies.toggleMenu).toBe("Toggle stickies menu");
    expect(stickies.emptyNote).toBe("Empty sticky note");
    expect(stickies.modalTitle).toBe("Your stickies");
    expect(stickies.showAll).toBe("Show all stickies →");
  });

  it("covers stickies search copy", () => {
    const stickies = enUS.stickies as unknown as Record<
      string,
      Record<string, unknown>
    >;
    expect(stickies.search?.label).toBe("Search stickies");
    expect(stickies.search?.placeholder).toBe("Search stickies");
    expect(stickies.search?.clear).toBe("Clear search");
  });

  it("covers stickies color palette and toolbar copy", () => {
    const stickies = enUS.stickies as unknown as Record<
      string,
      Record<string, unknown>
    >;
    expect(stickies.colors?.heading).toBe("Background colors");
    expect(stickies.colors?.lightBlue).toBe("Light blue");
    expect(stickies.colors?.darkBlue).toBe("Dark blue");
    expect(stickies.toolbar?.bold).toBe("Bold");
    expect(stickies.toolbar?.italic).toBe("Italic");
    expect(stickies.toolbar?.todoList).toBe("To-do list");
    expect(stickies.toolbar?.backgroundColor).toBe("Background color");
    expect(stickies.toolbar?.delete).toBe("Delete");
  });

  it("covers stickies card, delete dialog, empty states, and create toasts", () => {
    const stickies = enUS.stickies as unknown as Record<
      string,
      Record<string, unknown>
    >;
    expect(stickies.card?.drag).toBe("Drag sticky");
    expect(stickies.card?.close).toBe("Close");
    expect(stickies.card?.placeholder).toBe("Click to type here");
    expect(stickies.card?.removed).toBe("Sticky removed");
    expect(stickies.card?.removeFailed).toBe("Failed to remove sticky");
    expect(stickies.deleteDialog?.title).toBe("Delete sticky");
    expect(stickies.deleteDialog?.description).toBe(
      "Are you sure you want to delete this sticky?",
    );
    expect(stickies.deleteDialog?.cancel).toBe("Cancel");
    expect(stickies.deleteDialog?.delete).toBe("Delete");
    expect(stickies.deleteDialog?.deleting).toBe("Deleting...");
    expect(stickies.empty?.title).toBe(
      "Capture your thoughts and ideas with stickies.",
    );
    expect(stickies.empty?.description).toBe(
      "Create stickies for quick notes and to-dos, and keep them with you wherever you go.",
    );
    expect(stickies.empty?.searchTitle).toBe(
      "That doesn't match any of your stickies.",
    );
    expect(stickies.empty?.searchDescription).toBe(
      "Try a different term or let us know if you are sure your search is right.",
    );
    expect(stickies.create?.created).toBe("Sticky created");
    expect(stickies.create?.emptyExists).toBe(
      "There already exists a sticky with no description",
    );
    expect(stickies.create?.failed).toBe("Failed to create sticky");
  });
});
