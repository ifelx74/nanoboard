import Dexie, { type Table } from "dexie";
import type { Column, Project, Task } from "./schema";
import { seedDatabase } from "./seed";

export class NanoboardDB extends Dexie {
  projects!: Table<Project, string>;
  columns!: Table<Column, string>;
  tasks!: Table<Task, string>;

  constructor(name = "nanoboard") {
    super(name);
    this.version(1).stores({
      projects: "&id, slug, position",
      columns: "&id, projectId, [projectId+position]",
      tasks:
        "&id, projectId, columnId, status, dueDate, [projectId+columnId], [projectId+number]",
    });
    // Reserved upgrade slot for v2 index/field additions.
    this.on("populate", () => seedDatabase(this));
  }
}

export const db = new NanoboardDB();
