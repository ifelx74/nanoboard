import { describe, expect, it } from "vitest";
import enUS from "./locales/en-US.json";

describe("project extraction (ticket 10)", () => {
  it("covers create/edit/delete dialog copy", () => {
    const project = enUS.project as unknown as Record<
      string,
      Record<string, unknown>
    >;
    expect(project.create?.title).toBe("New project");
    expect(project.create?.keyHint).toBe(
      "Tasks show as {{example}}-1, {{example}}-2, …",
    );
    expect(project.edit?.title).toBe("Edit project");
    expect(project.delete?.title).toBe("Delete project?");
    expect(project.delete?.description).toBe(
      "“{{name}}” and all of its columns, tasks, and labels will be permanently deleted. This cannot be undone.",
    );
  });

  it("covers import dialog copy, plurals, and toasts", () => {
    const project = enUS.project as unknown as Record<
      string,
      Record<string, unknown>
    >;
    const imp = project.import as Record<string, unknown>;
    expect(imp.title).toBe("Import tasks");
    expect(imp.importButton_one).toBe("Import {{count}} task");
    expect(imp.importButton_other).toBe("Import {{count}} tasks");
    expect(imp.toasts).toMatchObject({
      imported_one: "{{count}} task imported.",
      imported_other: "{{count}} tasks imported.",
    });
    expect(imp.chooseJsonError).toBe("Choose a JSON file.");
  });

  it("covers toolbar and archives copy", () => {
    const project = enUS.project as unknown as Record<
      string,
      Record<string, unknown>
    >;
    const toolbar = project.toolbar as Record<string, unknown>;
    expect(toolbar.backlog).toBe("Backlog");
    expect(toolbar.archivedTasks_one).toBe("{{count}} archived task");
    expect(toolbar.archivedTasks_other).toBe("{{count}} archived tasks");
    const archives = project.archives as Record<string, unknown>;
    expect(archives.emptyTitle).toBe("No archived tasks yet");
    expect(archives.restoreTask).toBe("Restore task");
    expect(archives.archivedOn).toBe("Archived on {{date}}");
  });

  it("covers icon picker copy", () => {
    const project = enUS.project as unknown as Record<
      string,
      Record<string, unknown>
    >;
    expect(project.iconPicker?.pickTitle).toBe("Pick an icon");
    expect(project.iconPicker?.searchPlaceholder).toBe("Search icons");
  });
});
