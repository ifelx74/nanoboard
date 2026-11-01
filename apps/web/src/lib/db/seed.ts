import type Dexie from "dexie";
import type { Table } from "dexie";
import { DEFAULT_PROJECT_ICON, columnSlug, startDate } from "./schema";
import type {
  Column,
  DueDateString,
  Label,
  Project,
  Task,
  TaskLabel,
} from "./schema";

/** Minimal surface seed routines need; the connection module satisfies this. */
export interface SeedableDb {
  projects: Table<Project, string>;
  columns: Table<Column, string>;
  tasks: Table<Task, string>;
  labels: Table<Label, string>;
  taskLabels: Table<TaskLabel, [string, string]>;
}

export interface SeedRows {
  projects: Project[];
  columns: Column[];
  tasks: Task[];
  labels: Label[];
  taskLabels: TaskLabel[];
}

function isoDaysFromNow(days: number): DueDateString {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10) as DueDateString;
}

/**
 * Demo content, seeded on first database creation in `vite dev` only (see
 * the populate registration in db.ts). Production users start from an empty
 * workspace. A single shared `now` keeps seed timestamps internally
 * consistent. Task numbers follow the original listed order per project
 * (not id sort).
 */
export function buildSeedRows(now: number = Date.now()): SeedRows {
  const projects: Project[] = [
    {
      id: "p-website",
      name: "Website relaunch",
      slug: "WR",
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
      slug: "MA",
      description: "iOS and Android client",
      icon: DEFAULT_PROJECT_ICON,
      position: 1,
      lastTaskNumber: 4,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const columns: Column[] = [
    {
      id: "c-web-backlog",
      projectId: "p-website",
      name: "Backlog",
      slug: columnSlug("backlog"),
      position: 0,
      isFinal: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "c-web-todo",
      projectId: "p-website",
      name: "To Do",
      slug: columnSlug("to-do"),
      position: 1,
      isFinal: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "c-web-progress",
      projectId: "p-website",
      name: "In Progress",
      slug: columnSlug("in-progress"),
      position: 2,
      isFinal: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "c-web-review",
      projectId: "p-website",
      name: "In Review",
      slug: columnSlug("in-review"),
      position: 3,
      isFinal: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "c-web-done",
      projectId: "p-website",
      name: "Completed",
      slug: columnSlug("done"),
      position: 4,
      isFinal: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "c-mob-backlog",
      projectId: "p-mobile",
      name: "Backlog",
      slug: columnSlug("backlog"),
      position: 0,
      isFinal: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "c-mob-todo",
      projectId: "p-mobile",
      name: "To Do",
      slug: columnSlug("to-do"),
      position: 1,
      isFinal: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "c-mob-progress",
      projectId: "p-mobile",
      name: "In Progress",
      slug: columnSlug("in-progress"),
      position: 2,
      isFinal: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "c-mob-review",
      projectId: "p-mobile",
      name: "In Review",
      slug: columnSlug("in-review"),
      position: 3,
      isFinal: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "c-mob-done",
      projectId: "p-mobile",
      name: "Completed",
      slug: columnSlug("done"),
      position: 4,
      isFinal: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const tasks: Task[] = [
    {
      id: "t-1",
      projectId: "p-website",
      columnId: "c-web-todo",
      status: columnSlug("to-do"),
      title: "Draft new homepage copy",
      description: "",
      position: 0,
      number: 1,
      priority: "medium",
      dueDate: isoDaysFromNow(2),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "t-2",
      projectId: "p-website",
      columnId: "c-web-todo",
      status: columnSlug("to-do"),
      title: "Collect brand assets",
      description: "",
      position: 1,
      number: 2,
      priority: "low",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "t-3",
      projectId: "p-website",
      columnId: "c-web-progress",
      status: columnSlug("in-progress"),
      title: "Build pricing section",
      description: "",
      position: 0,
      number: 3,
      priority: "high",
      startDate: startDate(isoDaysFromNow(-2)),
      dueDate: isoDaysFromNow(0),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "t-4",
      projectId: "p-website",
      columnId: "c-web-review",
      status: columnSlug("in-review"),
      title: "Migrate blog posts",
      description: "",
      position: 0,
      number: 4,
      priority: "medium",
      startDate: startDate(isoDaysFromNow(1)),
      dueDate: isoDaysFromNow(5),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "t-5",
      projectId: "p-website",
      columnId: "c-web-done",
      status: columnSlug("done"),
      title: "Set up staging deploy",
      description: "",
      position: 0,
      number: 5,
      priority: "low",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "t-6",
      projectId: "p-mobile",
      columnId: "c-mob-todo",
      status: columnSlug("to-do"),
      title: "Design offline sync flow",
      description: "",
      position: 0,
      number: 1,
      priority: "urgent",
      dueDate: isoDaysFromNow(3),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "t-7",
      projectId: "p-mobile",
      columnId: "c-mob-progress",
      status: columnSlug("in-progress"),
      title: "Implement push notifications",
      description: "",
      position: 0,
      number: 2,
      priority: "high",
      dueDate: isoDaysFromNow(1),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "t-9",
      projectId: "p-mobile",
      columnId: "c-mob-review",
      status: columnSlug("in-review"),
      title: "Fix login crash on Android 14",
      description: "",
      position: 0,
      number: 3,
      priority: "high",
      dueDate: isoDaysFromNow(4),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "t-8",
      projectId: "p-mobile",
      columnId: "c-mob-done",
      status: columnSlug("done"),
      title: "Release 1.2 to TestFlight",
      description: "",
      position: 0,
      number: 4,
      priority: "medium",
      createdAt: now,
      updatedAt: now,
    },
  ];

  return { projects, columns, tasks, ...buildDemoLabels(now) };
}

/**
 * Demo-only label palettes for the two demo projects plus a few assignments,
 * so the label UI has real data in development. The default palette used by
 * real projects (and the v3 upgrade backfill) is `buildDefaultLabels` below.
 */
function buildDemoLabels(
  now: number,
): { labels: Label[]; taskLabels: TaskLabel[] } {
  const labels: Label[] = [
    { id: "l-web-bug", projectId: "p-website", name: "bug", color: "red" },
    {
      id: "l-web-feature",
      projectId: "p-website",
      name: "feature",
      color: "green",
    },
    {
      id: "l-web-design",
      projectId: "p-website",
      name: "design",
      color: "purple",
    },
    { id: "l-web-docs", projectId: "p-website", name: "docs", color: "gray" },
    { id: "l-mob-crash", projectId: "p-mobile", name: "crash", color: "red" },
    { id: "l-mob-sync", projectId: "p-mobile", name: "sync", color: "teal" },
    {
      id: "l-mob-release",
      projectId: "p-mobile",
      name: "release",
      color: "yellow",
    },
  ].map((entry) => ({ ...entry, createdAt: now, updatedAt: now }));

  const taskLabels: TaskLabel[] = [
    { taskId: "t-1", labelId: "l-web-design" },
    { taskId: "t-3", labelId: "l-web-feature" },
    { taskId: "t-4", labelId: "l-web-docs" },
    { taskId: "t-9", labelId: "l-mob-crash" },
    { taskId: "t-6", labelId: "l-mob-sync" },
    { taskId: "t-8", labelId: "l-mob-release" },
  ];

  return { labels, taskLabels };
}

async function addSeedRows(db: SeedableDb, rows: SeedRows): Promise<void> {
  await db.projects.bulkAdd(rows.projects);
  await db.columns.bulkAdd(rows.columns);
  await db.tasks.bulkAdd(rows.tasks);
  await db.labels.bulkAdd(rows.labels);
  await db.taskLabels.bulkAdd(rows.taskLabels);
}

/** Dev-only: runs inside the `populate` transaction on database creation. */
export async function seedDatabase(db: SeedableDb): Promise<void> {
  await addSeedRows(db, buildSeedRows());
}

/**
 * Dev-only reset: clears all rows and restores demo content. Wired to
 * `window.resetNanoboardToSeed` in main.tsx (dev builds only) — the populate
 * seeding fires once per database, so this is how an existing dev database
 * gets the demo content back.
 */
export async function resetToSeed(db: Dexie & SeedableDb): Promise<void> {
  await db.transaction(
    "rw",
    db.projects,
    db.columns,
    db.tasks,
    db.labels,
    db.taskLabels,
    async () => {
      await db.taskLabels.clear();
      await db.tasks.clear();
      await db.labels.clear();
      await db.columns.clear();
      await db.projects.clear();
      await addSeedRows(db, buildSeedRows());
    },
  );
}

/**
 * The default label palette, backfilled by the v3 upgrade for pre-existing
 * profiles whose projects predate labels. Fresh databases start empty and
 * new projects create no labels until the user does.
 */
export function buildDefaultLabels(
  projectIds: string[],
  now: number = Date.now(),
): Label[] {
  const palette = [
    { name: "bug", color: "red" },
    { name: "feature", color: "green" },
    { name: "docs", color: "gray" },
  ];
  const labels: Label[] = [];
  for (const projectId of projectIds) {
    for (const entry of palette) {
      labels.push({
        id: `l-${projectId}-${entry.name}`,
        projectId,
        ...entry,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return labels;
}
