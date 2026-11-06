import { describe, expect, it } from "vitest";
import { buildTestContents, makeTask } from "../db/test-db";
import { columnSlug } from "../db/schema";
import { buildTaskTransferDocument } from "./export";

describe("buildTaskTransferDocument", () => {
  it("emits archivedAt as an ISO timestamp for archived tasks and null for active ones", async () => {
    const base = buildTestContents();
    const archivedAt = 1_750_000_000_000;
    const contents = {
      ...base,
      tasks: [
        ...base.tasks,
        makeTask({
          id: "task-3",
          columnId: "column-3",
          status: columnSlug("done"),
          title: "Ship the release",
          number: 3,
          position: 0,
          archivedAt,
        }),
      ],
    };

    const document = await buildTaskTransferDocument({
      project: contents.projects[0]!,
      columns: contents.columns,
      tasks: contents.tasks,
      labelsByTask: new Map(),
      exportedAt: "2026-06-01T00:00:00.000Z",
    });

    const byTitle = new Map(document.tasks.map((task) => [task.title, task]));
    expect(byTitle.get("Test task")?.archivedAt).toBeNull();
    expect(byTitle.get("Wire up the label picker")?.archivedAt).toBeNull();
    expect(byTitle.get("Ship the release")?.archivedAt).toBe(
      new Date(archivedAt).toISOString(),
    );
  });
});
