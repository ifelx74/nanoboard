import { describe, expect, it } from "vitest";
import { makePage, TEST_NOW } from "../db/test-db";
import {
  countActivePageFilters,
  DEFAULT_PAGE_LIST_FILTERS,
  DEFAULT_PAGE_SORT,
  filterAndSortPages,
  hasActivePageFilters,
  parsePagesTab,
} from "./list-model";

describe("parsePagesTab", () => {
  it("normalizes unknown values to all and preserves archived", () => {
    expect(parsePagesTab(undefined)).toBe("all");
    expect(parsePagesTab("all")).toBe("all");
    expect(parsePagesTab("archived")).toBe("archived");
    expect(parsePagesTab("public")).toBe("all");
    expect(parsePagesTab(123)).toBe("all");
  });
});

describe("filterAndSortPages — tab partitioning", () => {
  it("partitions active pages into the all tab and archived pages into the archived tab", () => {
    const pages = [
      makePage({ id: "active-1", title: "Spec", updatedAt: TEST_NOW }),
      makePage({
        id: "archived-1",
        title: "Legacy",
        archivedAt: TEST_NOW + 1_000,
        updatedAt: TEST_NOW + 1_000,
      }),
      makePage({
        id: "active-2",
        title: "Roadmap",
        updatedAt: TEST_NOW + 2_000,
      }),
    ];

    const allTab = filterAndSortPages(pages, {
      tab: "all",
      searchQuery: "",
      sort: DEFAULT_PAGE_SORT,
      filters: DEFAULT_PAGE_LIST_FILTERS,
      now: TEST_NOW + 5_000,
    });
    const archivedTab = filterAndSortPages(pages, {
      tab: "archived",
      searchQuery: "",
      sort: DEFAULT_PAGE_SORT,
      filters: DEFAULT_PAGE_LIST_FILTERS,
      now: TEST_NOW + 5_000,
    });

    expect(allTab.map((p) => p.id)).toEqual(["active-2", "active-1"]);
    expect(archivedTab.map((p) => p.id)).toEqual(["archived-1"]);
  });
});

describe("filterAndSortPages — title and body search", () => {
  it("matches case-insensitively across page title, untitled fallback, and body contentText", () => {
    const pages = [
      makePage({
        id: "p-title",
        title: "Release Checklist",
        updatedAt: TEST_NOW + 3_000,
      }),
      makePage({
        id: "p-body",
        title: "Meeting Notes",
        updatedAt: TEST_NOW + 2_000,
      }),
      makePage({
        id: "p-untitled",
        title: "",
        updatedAt: TEST_NOW + 1_000,
      }),
    ];
    const contentTextByPageId = new Map([
      ["p-title", "Ship it"],
      ["p-body", "Discuss Dexie migration checklist before beta"],
      ["p-untitled", "Scratchpad"],
    ]);

    const checklistMatches = filterAndSortPages(pages, {
      tab: "all",
      searchQuery: "  CHECKLIST ",
      contentTextByPageId,
      sort: DEFAULT_PAGE_SORT,
      filters: DEFAULT_PAGE_LIST_FILTERS,
      untitledLabel: "Untitled",
      now: TEST_NOW + 5_000,
    });
    expect(checklistMatches.map((p) => p.id)).toEqual(["p-title", "p-body"]);

    const untitledMatches = filterAndSortPages(pages, {
      tab: "all",
      searchQuery: "untitled",
      contentTextByPageId,
      sort: DEFAULT_PAGE_SORT,
      filters: DEFAULT_PAGE_LIST_FILTERS,
      untitledLabel: "Untitled",
      now: TEST_NOW + 5_000,
    });
    expect(untitledMatches.map((p) => p.id)).toEqual(["p-untitled"]);

    // Blank/whitespace query ignores contentTextByPageId and returns every page in the tab.
    const blankQuery = filterAndSortPages(pages, {
      tab: "all",
      searchQuery: "   ",
      sort: DEFAULT_PAGE_SORT,
      filters: DEFAULT_PAGE_LIST_FILTERS,
      now: TEST_NOW + 5_000,
    });
    expect(blankQuery.map((p) => p.id)).toEqual([
      "p-title",
      "p-body",
      "p-untitled",
    ]);
  });
});

describe("filterAndSortPages — sorting", () => {
  const samplePages = [
    makePage({
      id: "p-sprint-10",
      title: "Sprint 10",
      createdAt: TEST_NOW + 1_000,
      updatedAt: TEST_NOW + 3_000,
    }),
    makePage({
      id: "p-sprint-2",
      title: "sprint 2",
      createdAt: TEST_NOW + 3_000,
      updatedAt: TEST_NOW + 1_000,
    }),
    makePage({
      id: "p-untitled",
      title: "",
      createdAt: TEST_NOW + 2_000,
      updatedAt: TEST_NOW + 4_000,
    }),
    makePage({
      id: "p-alpha",
      title: "Alpha",
      createdAt: TEST_NOW + 4_000,
      updatedAt: TEST_NOW + 2_000,
    }),
  ];

  it("sorts by name asc and desc using natural case-insensitive collation with untitled fallback", () => {
    const asc = filterAndSortPages(samplePages, {
      tab: "all",
      searchQuery: "",
      sort: { key: "name", direction: "asc" },
      filters: DEFAULT_PAGE_LIST_FILTERS,
      untitledLabel: "Untitled",
      locale: "en-US",
      now: TEST_NOW + 10_000,
    });
    expect(asc.map((p) => p.id)).toEqual([
      "p-alpha",
      "p-sprint-2",
      "p-sprint-10",
      "p-untitled",
    ]);

    const desc = filterAndSortPages(samplePages, {
      tab: "all",
      searchQuery: "",
      sort: { key: "name", direction: "desc" },
      filters: DEFAULT_PAGE_LIST_FILTERS,
      untitledLabel: "Untitled",
      locale: "en-US",
      now: TEST_NOW + 10_000,
    });
    expect(desc.map((p) => p.id)).toEqual([
      "p-untitled",
      "p-sprint-10",
      "p-sprint-2",
      "p-alpha",
    ]);
  });

  it("sorts by createdAt and updatedAt in both ascending and descending directions", () => {
    const createdAsc = filterAndSortPages(samplePages, {
      tab: "all",
      searchQuery: "",
      sort: { key: "createdAt", direction: "asc" },
      filters: DEFAULT_PAGE_LIST_FILTERS,
      now: TEST_NOW + 10_000,
    });
    expect(createdAsc.map((p) => p.id)).toEqual([
      "p-sprint-10",
      "p-untitled",
      "p-sprint-2",
      "p-alpha",
    ]);

    const createdDesc = filterAndSortPages(samplePages, {
      tab: "all",
      searchQuery: "",
      sort: { key: "createdAt", direction: "desc" },
      filters: DEFAULT_PAGE_LIST_FILTERS,
      now: TEST_NOW + 10_000,
    });
    expect(createdDesc.map((p) => p.id)).toEqual([
      "p-alpha",
      "p-sprint-2",
      "p-untitled",
      "p-sprint-10",
    ]);

    const updatedAsc = filterAndSortPages(samplePages, {
      tab: "all",
      searchQuery: "",
      sort: { key: "updatedAt", direction: "asc" },
      filters: DEFAULT_PAGE_LIST_FILTERS,
      now: TEST_NOW + 10_000,
    });
    expect(updatedAsc.map((p) => p.id)).toEqual([
      "p-sprint-2",
      "p-alpha",
      "p-sprint-10",
      "p-untitled",
    ]);

    const updatedDesc = filterAndSortPages(samplePages, {
      tab: "all",
      searchQuery: "",
      sort: { key: "updatedAt", direction: "desc" },
      filters: DEFAULT_PAGE_LIST_FILTERS,
      now: TEST_NOW + 10_000,
    });
    expect(updatedDesc.map((p) => p.id)).toEqual([
      "p-untitled",
      "p-sprint-10",
      "p-alpha",
      "p-sprint-2",
    ]);
  });
});

describe("filterAndSortPages — filters and active-filter helpers", () => {
  const MS_PER_DAY = 24 * 60 * 60 * 1_000;
  // Pick a local-noon reference timestamp so start-of-day is well separated from midnight.
  const REF_NOW = new Date(2026, 5, 15, 12, 0, 0, 0).getTime();

  const pages = [
    makePage({
      id: "p-today-fav",
      title: "Today Fav",
      isFavorite: true,
      createdAt: new Date(2026, 5, 15, 1, 0, 0, 0).getTime(),
      updatedAt: REF_NOW - 1_000,
    }),
    makePage({
      id: "p-3d",
      title: "Three Days",
      isFavorite: false,
      createdAt: REF_NOW - 3 * MS_PER_DAY,
      updatedAt: REF_NOW - 2_000,
    }),
    makePage({
      id: "p-10d-fav",
      title: "Ten Days Fav",
      isFavorite: true,
      createdAt: REF_NOW - 10 * MS_PER_DAY,
      updatedAt: REF_NOW - 3_000,
    }),
    makePage({
      id: "p-25d",
      title: "Twenty Five Days",
      isFavorite: false,
      createdAt: REF_NOW - 25 * MS_PER_DAY,
      updatedAt: REF_NOW - 4_000,
    }),
    makePage({
      id: "p-45d-fav",
      title: "Old Fav",
      isFavorite: true,
      createdAt: REF_NOW - 45 * MS_PER_DAY,
      updatedAt: REF_NOW - 5_000,
    }),
  ];

  it("reports active filter count accurately", () => {
    expect(hasActivePageFilters(DEFAULT_PAGE_LIST_FILTERS)).toBe(false);
    expect(countActivePageFilters(DEFAULT_PAGE_LIST_FILTERS)).toBe(0);

    expect(
      countActivePageFilters({ favoritesOnly: true, createdDateRange: null }),
    ).toBe(1);
    expect(
      hasActivePageFilters({ favoritesOnly: false, createdDateRange: "today" }),
    ).toBe(true);
    expect(
      countActivePageFilters({
        favoritesOnly: true,
        createdDateRange: "last_7_days",
      }),
    ).toBe(2);
  });

  it("filters by favoritesOnly and each Created date range independently and together", () => {
    const favoritesOnly = filterAndSortPages(pages, {
      tab: "all",
      searchQuery: "",
      sort: DEFAULT_PAGE_SORT,
      filters: { favoritesOnly: true, createdDateRange: null },
      now: REF_NOW,
    });
    expect(favoritesOnly.map((p) => p.id)).toEqual([
      "p-today-fav",
      "p-10d-fav",
      "p-45d-fav",
    ]);

    const today = filterAndSortPages(pages, {
      tab: "all",
      searchQuery: "",
      sort: DEFAULT_PAGE_SORT,
      filters: { favoritesOnly: false, createdDateRange: "today" },
      now: REF_NOW,
    });
    expect(today.map((p) => p.id)).toEqual(["p-today-fav"]);

    const last7 = filterAndSortPages(pages, {
      tab: "all",
      searchQuery: "",
      sort: DEFAULT_PAGE_SORT,
      filters: { favoritesOnly: false, createdDateRange: "last_7_days" },
      now: REF_NOW,
    });
    expect(last7.map((p) => p.id)).toEqual(["p-today-fav", "p-3d"]);

    const last14 = filterAndSortPages(pages, {
      tab: "all",
      searchQuery: "",
      sort: DEFAULT_PAGE_SORT,
      filters: { favoritesOnly: false, createdDateRange: "last_14_days" },
      now: REF_NOW,
    });
    expect(last14.map((p) => p.id)).toEqual([
      "p-today-fav",
      "p-3d",
      "p-10d-fav",
    ]);

    const last30 = filterAndSortPages(pages, {
      tab: "all",
      searchQuery: "",
      sort: DEFAULT_PAGE_SORT,
      filters: { favoritesOnly: false, createdDateRange: "last_30_days" },
      now: REF_NOW,
    });
    expect(last30.map((p) => p.id)).toEqual([
      "p-today-fav",
      "p-3d",
      "p-10d-fav",
      "p-25d",
    ]);

    // Combined: favorites + last_14_days + search + name ascending sort
    const combined = filterAndSortPages(pages, {
      tab: "all",
      searchQuery: "fav",
      sort: { key: "name", direction: "asc" },
      filters: { favoritesOnly: true, createdDateRange: "last_14_days" },
      locale: "en-US",
      now: REF_NOW,
    });
    expect(combined.map((p) => p.id)).toEqual(["p-10d-fav", "p-today-fav"]);
  });
});
