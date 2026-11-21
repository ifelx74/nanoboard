import { describe, expect, it } from "vitest";
import {
  filterSlashCommandSections,
  getNextSlashCommandIndex,
  mergeAdditionalSlashItems,
  splitHighlightMatch,
  type SlashCommandSection,
} from "./slash-commands";

interface DummyItem {
  key: string;
  commandKey: string;
  title: string;
  description: string;
  searchTerms: string[];
}

function makeItem(
  key: string,
  title: string,
  description: string,
  searchTerms: string[] = [],
  commandKey = key,
): DummyItem {
  return { key, commandKey, title, description, searchTerms };
}

const SAMPLE_SECTIONS: SlashCommandSection<DummyItem>[] = [
  {
    key: "general",
    items: [
      makeItem("text", "Text", "Plain paragraph", ["p", "paragraph"]),
      makeItem("h1", "Heading 1", "Big section heading", ["title", "h1"]),
      makeItem("code", "Code", "Code block snippet", ["codeblock"]),
      makeItem("divider", "Divider", "Horizontal rule", ["hr", "line"]),
    ],
  },
  {
    key: "text-colors",
    title: "Colors",
    items: [
      makeItem("text-color-default", "Default", "Reset text color", [
        "color",
        "text",
      ]),
      makeItem("text-color-peach", "Peach", "Change text color", [
        "color",
        "text",
        "peach",
      ]),
    ],
  },
  {
    key: "background-colors",
    title: "Background colors",
    items: [
      makeItem(
        "background-color-default",
        "Default background",
        "Reset background color",
        ["bg", "background", "default"],
      ),
      makeItem("background-color-green", "Green", "Change background color", [
        "bg",
        "background",
        "green",
      ]),
    ],
  },
];

describe("pages slash command helpers", () => {
  it("merges downstream additional items after pushAfter and omits disabled keys", () => {
    const merged = mergeAdditionalSlashItems(
      SAMPLE_SECTIONS,
      [
        {
          section: "general",
          pushAfter: "code",
          item: makeItem("callout", "Callout", "Insert callout", ["info"]),
        },
        {
          section: "general",
          pushAfter: "missing-key",
          item: makeItem("emoji", "Emoji", "Insert emoji", ["smile"]),
        },
      ],
      ["divider"],
    );

    const generalKeys = merged[0]?.items.map((item) => item.key);
    expect(generalKeys).toEqual(["text", "h1", "code", "callout", "emoji"]);
  });

  it("filters sections by title, description, and searchTerms case-insensitively and prunes empty sections", () => {
    expect(filterSlashCommandSections(SAMPLE_SECTIONS, "")).toHaveLength(3);

    const peachOnly = filterSlashCommandSections(SAMPLE_SECTIONS, "PEACH");
    expect(peachOnly.map((s) => s.key)).toEqual(["text-colors"]);
    expect(peachOnly[0]?.items.map((i) => i.key)).toEqual(["text-color-peach"]);

    const bgResults = filterSlashCommandSections(SAMPLE_SECTIONS, "bg");
    expect(bgResults.map((s) => s.key)).toEqual(["background-colors"]);
    expect(bgResults[0]?.items).toHaveLength(2);

    const hrResults = filterSlashCommandSections(SAMPLE_SECTIONS, "horizontal");
    expect(hrResults.map((s) => s.key)).toEqual(["general"]);
    expect(hrResults[0]?.items.map((i) => i.key)).toEqual(["divider"]);

    expect(
      filterSlashCommandSections(SAMPLE_SECTIONS, "zzzz-no-match"),
    ).toEqual([]);
  });

  it("splits substring match preserving original casing for highlighting", () => {
    expect(splitHighlightMatch("Heading 1", "ead")).toEqual({
      before: "H",
      match: "ead",
      after: "ing 1",
    });
    expect(splitHighlightMatch("Background colors", "BACK")).toEqual({
      before: "",
      match: "Back",
      after: "ground colors",
    });
    expect(splitHighlightMatch("Divider", "")).toBeNull();
    expect(splitHighlightMatch("Divider", "   ")).toBeNull();
    expect(splitHighlightMatch("Divider", "quote")).toBeNull();
  });

  it("navigates across section boundaries with wrap-around for up and down arrows", () => {
    // From last item of section 0 -> first item of section 1
    expect(
      getNextSlashCommandIndex(
        SAMPLE_SECTIONS,
        { section: 0, item: 3 },
        "down",
      ),
    ).toEqual({ section: 1, item: 0 });

    // From last item of last section -> wrap to (0, 0)
    expect(
      getNextSlashCommandIndex(
        SAMPLE_SECTIONS,
        { section: 2, item: 1 },
        "down",
      ),
    ).toEqual({ section: 0, item: 0 });

    // From (0, 0) moving up -> last item of last section
    expect(
      getNextSlashCommandIndex(SAMPLE_SECTIONS, { section: 0, item: 0 }, "up"),
    ).toEqual({ section: 2, item: 1 });

    // From first item of section 1 moving up -> last item of section 0
    expect(
      getNextSlashCommandIndex(SAMPLE_SECTIONS, { section: 1, item: 0 }, "up"),
    ).toEqual({ section: 0, item: 3 });

    // Empty sections returns null
    expect(
      getNextSlashCommandIndex([], { section: 0, item: 0 }, "down"),
    ).toBeNull();
  });
});
