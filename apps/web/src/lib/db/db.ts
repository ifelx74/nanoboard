import Dexie, { type Table } from "dexie";
import type {
  Column,
  Label,
  Project,
  Task,
  TaskLabel,
  TaskResource,
} from "./schema";
import { buildLabelSeedRows, seedDatabase } from "./seed";

export class NanoboardDB extends Dexie {
  projects!: Table<Project, string>;
  columns!: Table<Column, string>;
  tasks!: Table<Task, string>;
  labels!: Table<Label, string>;
  taskLabels!: Table<TaskLabel, [string, string]>;
  taskResources!: Table<TaskResource, string>;

  constructor(name = "nanoboard") {
    super(name);
    // v2: per-project task numbers are store-enforced unique and column
    // contents carry an ordered compound index, so position allocation and
    // ordering read straight off the index. v1 profile data migrates
    // automatically (seed numbers already satisfy uniqueness).
    this.version(2).stores({
      projects: "&id, slug, position",
      columns: "&id, projectId, [projectId+position]",
      tasks:
        "&id, projectId, columnId, status, dueDate, [projectId+columnId+position], &[projectId+number]",
    });
    // v3: label palette per project plus the assignment join. The compound
    // primary key makes re-attaching an existing pair a no-op. `populate`
    // only fires on fresh creation, so the upgrade backfills the default
    // palette for pre-existing profiles.
    //
    // startDate needs no version bump or upgrade: it is an unindexed
    // optional property (Kaneo likewise carries no startDate-only index),
    // so pre-existing rows simply read it as absent.
    this.version(3)
      .stores({
        projects: "&id, slug, position",
        columns: "&id, projectId, [projectId+position]",
        tasks:
          "&id, projectId, columnId, status, dueDate, [projectId+columnId+position], &[projectId+number]",
        labels: "&id, projectId, &[projectId+name]",
        taskLabels: "&[taskId+labelId], taskId, labelId",
      })
      .upgrade(async (tx) => {
        const projects = await tx.table("projects").toArray();
        const { labels } = buildLabelSeedRows(
          projects.map((p: { id: string }) => p.id),
          Date.now(),
        );
        await tx.table("labels").bulkAdd(labels);
      });
    // v4: per-task manual URL links (Kaneo's external_link minus the
    // integration columns). A new empty table needs no upgrade function.
    this.version(4).stores({
      projects: "&id, slug, position",
      columns: "&id, projectId, [projectId+position]",
      tasks:
        "&id, projectId, columnId, status, dueDate, [projectId+columnId+position], &[projectId+number]",
      labels: "&id, projectId, &[projectId+name]",
      taskLabels: "&[taskId+labelId], taskId, labelId",
      taskResources: "&id, taskId",
    });
    this.on("populate", () => seedDatabase(this));
  }
}

export const db = new NanoboardDB();
