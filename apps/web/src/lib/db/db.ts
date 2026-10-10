import Dexie, { type Table } from "dexie";
import type { Column, Project, Task } from "./schema";
import { seedDatabase } from "./seed";

export class NanoboardDB extends Dexie {
  projects!: Table<Project, string>;
  columns!: Table<Column, string>;
  tasks!: Table<Task, string>;

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
    this.on("populate", () => seedDatabase(this));
  }
}

export const db = new NanoboardDB();
