import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { i18n, initI18n } from "./i18n";
import {
  displayProjectName,
  pageMeta,
  projectPageDetailMeta,
  projectPageDetailRouteHead,
  projectPageMeta,
  projectRouteHead,
} from "./seo";

describe("displayProjectName", () => {
  it("passes through names within the limit", () => {
    expect(displayProjectName("Academic")).toBe("Academic");
    expect(displayProjectName("x".repeat(34))).toBe("x".repeat(34));
  });

  it("trims surrounding whitespace", () => {
    expect(displayProjectName("  Academic  ")).toBe("Academic");
  });

  it("truncates overlong names with an ellipsis, keeping the cap", () => {
    const result = displayProjectName("y".repeat(100));
    expect(result).toHaveLength(34);
    expect(result?.endsWith("…")).toBe(true);
  });

  it("returns undefined for a missing project", () => {
    expect(displayProjectName(undefined)).toBeUndefined();
  });
});

describe("pageMeta", () => {
  it("emits a title descriptor followed by a description descriptor", () => {
    expect(pageMeta("T", "D")).toEqual({
      meta: [{ title: "T" }, { name: "description", content: "D" }],
    });
  });
});

describe("projectPageMeta", () => {
  beforeAll(async () => {
    await initI18n("en-US");
  });

  afterAll(async () => {
    await i18n.changeLanguage("en-US");
  });

  it("composes the section, project name, and app suffix", () => {
    const result = projectPageMeta("board", "Academic");
    expect(result).toEqual({
      meta: [
        { title: "Board — Academic · Nanoboard" },
        {
          name: "description",
          content:
            "Kanban board for Academic — tasks, columns, and labels, all local-first.",
        },
      ],
    });
  });

  it("falls back to a bare Nanoboard title for a missing project", () => {
    const result = projectPageMeta("board", undefined);
    expect(result.meta[0]).toEqual({ title: "Nanoboard" });
  });

  it("truncates a very long project name in the title", () => {
    const result = projectPageMeta("list", "z".repeat(80));
    const title = (result.meta[0] as { title: string }).title;
    expect(title).toBe(`List — ${"z".repeat(33)}… · Nanoboard`);
  });

  it("renders French titles after a language switch", async () => {
    await i18n.changeLanguage("fr-FR");
    const result = projectPageMeta("board", "Academic");
    expect(result.meta[0]).toEqual({
      title: "Kanban — Academic · Nanoboard",
    });
    await i18n.changeLanguage("en-US");
  });
});

describe("projectRouteHead", () => {
  beforeAll(async () => {
    await initI18n("en-US");
  });

  it("builds the head from the loader's project row", () => {
    const head = projectRouteHead("calendar");
    expect(head({ loaderData: { name: "Academic" } }).meta[0]).toEqual({
      title: "Calendar — Academic · Nanoboard",
    });
  });

  it("falls back when the loader yields nothing", () => {
    const head = projectRouteHead("calendar");
    expect(head({}).meta[0]).toEqual({ title: "Nanoboard" });
  });

  it("composes pages list metadata in en-US and fr-FR", async () => {
    const enResult = projectPageMeta("pages", "Academic");
    expect(enResult).toEqual({
      meta: [
        { title: "Pages — Academic · Nanoboard" },
        {
          name: "description",
          content:
            "Project pages and docs for Academic — rich notes, stored locally in your browser.",
        },
      ],
    });

    await i18n.changeLanguage("fr-FR");
    const frResult = projectPageMeta("pages", "Academic");
    expect(frResult).toEqual({
      meta: [
        { title: "Pages — Academic · Nanoboard" },
        {
          name: "description",
          content:
            "Pages et documents de Academic — notes structurées, stockées localement dans votre navigateur.",
        },
      ],
    });
    await i18n.changeLanguage("en-US");
  });
});

describe("projectPageDetailMeta & projectPageDetailRouteHead", () => {
  beforeAll(async () => {
    await initI18n("en-US");
  });

  afterAll(async () => {
    await i18n.changeLanguage("en-US");
  });

  it("includes the page title when present and truncates overlong titles", () => {
    const titled = projectPageDetailMeta("Academic", "Architecture Spec");
    expect(titled.meta[0]).toEqual({
      title: "Architecture Spec — Academic · Nanoboard",
    });

    const overlong = projectPageDetailMeta("Academic", "a".repeat(80));
    expect(overlong.meta[0]).toEqual({
      title: `${"a".repeat(49)}… — Academic · Nanoboard`,
    });
  });

  it("falls back to the Pages list title when the page title is blank or missing", () => {
    expect(projectPageDetailMeta("Academic", "").meta[0]).toEqual({
      title: "Pages — Academic · Nanoboard",
    });
    expect(projectPageDetailMeta("Academic", "   ").meta[0]).toEqual({
      title: "Pages — Academic · Nanoboard",
    });
    expect(projectPageDetailMeta("Academic", undefined).meta[0]).toEqual({
      title: "Pages — Academic · Nanoboard",
    });
  });

  it("falls back to Nanoboard when the project is missing and reads loaderData in route head", () => {
    const head = projectPageDetailRouteHead();
    expect(
      head({
        loaderData: {
          project: { name: "Academic" },
          page: { title: "Roadmap" },
        },
      }).meta[0],
    ).toEqual({ title: "Roadmap — Academic · Nanoboard" });

    expect(head({}).meta[0]).toEqual({ title: "Nanoboard" });
  });
});
