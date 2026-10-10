import type Dexie from "dexie";
import type { Table } from "dexie";
import { DEFAULT_PROJECT_ICON } from "./schema";
import type {
  Column,
  ColumnSlug,
  DueDateString,
  Project,
  Task,
} from "./schema";

/** Minimal surface seed routines need; the connection module satisfies this. */
export interface SeedableDb {
  projects: Table<Project, string>;
  columns: Table<Column, string>;
  tasks: Table<Task, string>;
}

export interface SeedRows {
  projects: Project[];
  columns: Column[];
  tasks: Task[];
}

function isoDaysFromNow(days: number): DueDateString {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10) as DueDateString;
}

function slug(value: string): ColumnSlug {
  return value as ColumnSlug;
}

/**
 * 1:1 conversion of the former in-memory demo content. A single shared `now`
 * keeps seed timestamps internally consistent. Task numbers follow the
 * original listed order per project (not id sort).
 */
export function buildSeedRows(now: number = Date.now()): SeedRows {
  const projects: Project[] = [
    {
      id: "p-website",
      name: "Website relaunch",
      slug: "website-relaunch",
      description: "Marketing site rebuild",
      icon: DEFAULT_PROJECT_ICON,
      position: 0,
      lastTaskNumber: 5,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "p-mobile",
      name: "Mobile app",
      slug: "mobile-app",
      description: "iOS and Android client",
      icon: DEFAULT_PROJECT_ICON,
      position: 1,
      lastTaskNumber: 4,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const columns: Column[] = [
    { id: "c-web-todo", projectId: "p-website", name: "To Do", slug: slug("to-do"), position: 0, isFinal: false, createdAt: now, updatedAt: now },
    { id: "c-web-progress", projectId: "p-website", name: "In Progress", slug: slug("in-progress"), position: 1, isFinal: false, createdAt: now, updatedAt: now },
    { id: "c-web-review", projectId: "p-website", name: "In Review", slug: slug("in-review"), position: 2, isFinal: false, createdAt: now, updatedAt: now },
    { id: "c-web-done", projectId: "p-website", name: "Done", slug: slug("done"), position: 3, isFinal: true, createdAt: now, updatedAt: now },
    { id: "c-mob-todo", projectId: "p-mobile", name: "To Do", slug: slug("to-do"), position: 0, isFinal: false, createdAt: now, updatedAt: now },
    { id: "c-mob-progress", projectId: "p-mobile", name: "In Progress", slug: slug("in-progress"), position: 1, isFinal: false, createdAt: now, updatedAt: now },
    { id: "c-mob-review", projectId: "p-mobile", name: "In Review", slug: slug("in-review"), position: 2, isFinal: false, createdAt: now, updatedAt: now },
    { id: "c-mob-done", projectId: "p-mobile", name: "Done", slug: slug("done"), position: 3, isFinal: true, createdAt: now, updatedAt: now },
  ];

  const tasks: Task[] = [
    { id: "t-1", projectId: "p-website", columnId: "c-web-todo", status: slug("to-do"), title: "Draft new homepage copy", description: "", position: 0, number: 1, priority: "medium", dueDate: isoDaysFromNow(2), createdAt: now, updatedAt: now },
    { id: "t-2", projectId: "p-website", columnId: "c-web-todo", status: slug("to-do"), title: "Collect brand assets", description: "", position: 1, number: 2, priority: "low", createdAt: now, updatedAt: now },
    { id: "t-3", projectId: "p-website", columnId: "c-web-progress", status: slug("in-progress"), title: "Build pricing section", description: "", position: 0, number: 3, priority: "high", dueDate: isoDaysFromNow(0), createdAt: now, updatedAt: now },
    { id: "t-4", projectId: "p-website", columnId: "c-web-review", status: slug("in-review"), title: "Migrate blog posts", description: "", position: 0, number: 4, priority: "medium", dueDate: isoDaysFromNow(5), createdAt: now, updatedAt: now },
    { id: "t-5", projectId: "p-website", columnId: "c-web-done", status: slug("done"), title: "Set up staging deploy", description: "", position: 0, number: 5, priority: "low", createdAt: now, updatedAt: now },
    { id: "t-6", projectId: "p-mobile", columnId: "c-mob-todo", status: slug("to-do"), title: "Design offline sync flow", description: "", position: 0, number: 1, priority: "urgent", dueDate: isoDaysFromNow(3), createdAt: now, updatedAt: now },
    { id: "t-7", projectId: "p-mobile", columnId: "c-mob-progress", status: slug("in-progress"), title: "Implement push notifications", description: "", position: 0, number: 2, priority: "high", dueDate: isoDaysFromNow(1), createdAt: now, updatedAt: now },
    { id: "t-9", projectId: "p-mobile", columnId: "c-mob-review", status: slug("in-review"), title: "Fix login crash on Android 14", description: "", position: 0, number: 3, priority: "high", dueDate: isoDaysFromNow(4), createdAt: now, updatedAt: now },
    { id: "t-8", projectId: "p-mobile", columnId: "c-mob-done", status: slug("done"), title: "Release 1.2 to TestFlight", description: "", position: 0, number: 4, priority: "medium", createdAt: now, updatedAt: now },
  ];

  return { projects, columns, tasks };
}

/** Runs inside the `populate` transaction on first database creation only. */
export async function seedDatabase(db: SeedableDb): Promise<void> {
  const { projects, columns, tasks } = buildSeedRows();
  await db.projects.bulkAdd(projects);
  await db.columns.bulkAdd(columns);
  await db.tasks.bulkAdd(tasks);
}

/** Dev-only reset: clears all rows and restores seed content. No UI calls this. */
export async function resetToSeed(db: Dexie & SeedableDb): Promise<void> {
  await db.transaction("rw", db.projects, db.columns, db.tasks, async () => {
    await db.tasks.clear();
    await db.columns.clear();
    await db.projects.clear();
    const { projects, columns, tasks } = buildSeedRows();
    await db.projects.bulkAdd(projects);
    await db.columns.bulkAdd(columns);
    await db.tasks.bulkAdd(tasks);
  });
}
