import { createId } from "@paralleldrive/cuid2";
import type Dexie from "dexie";
import type { Table } from "dexie";
import {
  DEFAULT_COLUMNS,
  DEFAULT_PROJECT_ICON,
  columnSlug,
  startDate,
} from "./schema";
import { suggestProjectKey } from "../task-key";
import type {
  Column,
  ColumnSlug,
  DueDateString,
  Label,
  Project,
  Task,
  TaskLabel,
  TaskPriority,
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
 * Demo content, seeded on first database creation (see the populate
 * registration in db.ts). Rows are minted exactly as the app creates them —
 * cuid2 ids, keys from `suggestProjectKey`, the DEFAULT_COLUMNS board — so a
 * seeded database is indistinguishable from a user-built one. A single shared
 * `now` keeps timestamps internally consistent. Task numbers follow the
 * listed order per project (not id sort).
 */
export function buildSeedRows(now: number = Date.now()): SeedRows {
  const websiteId = createId();
  const mobileId = createId();

  // Columns exactly as `createProject` writes them.
  const columnIdByProject = new Map<string, Map<ColumnSlug, string>>();
  const columns: Column[] = [];
  for (const projectId of [websiteId, mobileId]) {
    const bySlug = new Map<ColumnSlug, string>();
    for (const def of DEFAULT_COLUMNS) {
      const id = createId();
      bySlug.set(def.slug, id);
      columns.push({
        id,
        projectId,
        name: def.name,
        slug: def.slug,
        position: def.position,
        isFinal: def.isFinal,
        createdAt: now,
        updatedAt: now,
      });
    }
    columnIdByProject.set(projectId, bySlug);
  }

  const requireColumnId = (projectId: string, slug: string): string => {
    const id = columnIdByProject.get(projectId)?.get(columnSlug(slug));
    if (!id) {
      throw new Error(`Demo column "${slug}" was not built.`);
    }
    return id;
  };

  const taskDefs: {
    key: string;
    projectId: string;
    column: string;
    title: string;
    priority: TaskPriority;
    startDaysFromNow?: number;
    dueDaysFromNow?: number;
  }[] = [
    {
      key: "web-1",
      projectId: websiteId,
      column: "to-do",
      title: "Draft new homepage copy",
      priority: "medium",
      dueDaysFromNow: 2,
    },
    {
      key: "web-2",
      projectId: websiteId,
      column: "to-do",
      title: "Collect brand assets",
      priority: "low",
    },
    {
      key: "web-3",
      projectId: websiteId,
      column: "in-progress",
      title: "Build pricing section",
      priority: "high",
      startDaysFromNow: -2,
      dueDaysFromNow: 0,
    },
    {
      key: "web-4",
      projectId: websiteId,
      column: "in-review",
      title: "Migrate blog posts",
      priority: "medium",
      startDaysFromNow: 1,
      dueDaysFromNow: 5,
    },
    {
      key: "web-5",
      projectId: websiteId,
      column: "done",
      title: "Set up staging deploy",
      priority: "low",
    },
    {
      key: "mob-1",
      projectId: mobileId,
      column: "to-do",
      title: "Design offline sync flow",
      priority: "urgent",
      dueDaysFromNow: 3,
    },
    {
      key: "mob-2",
      projectId: mobileId,
      column: "in-progress",
      title: "Implement push notifications",
      priority: "high",
      dueDaysFromNow: 1,
    },
    {
      key: "mob-3",
      projectId: mobileId,
      column: "in-review",
      title: "Fix login crash on Android 14",
      priority: "high",
      dueDaysFromNow: 4,
    },
    {
      key: "mob-4",
      projectId: mobileId,
      column: "done",
      title: "Release 1.2 to TestFlight",
      priority: "medium",
    },
  ];

  const taskIdByKey = new Map<string, string>();
  const numberByProject = new Map<string, number>();
  const positionByColumn = new Map<string, number>();
  const tasks: Task[] = taskDefs.map((def) => {
    const columnId = requireColumnId(def.projectId, def.column);
    const number = (numberByProject.get(def.projectId) ?? 0) + 1;
    numberByProject.set(def.projectId, number);
    const position = positionByColumn.get(columnId) ?? 0;
    positionByColumn.set(columnId, position + 1);
    const id = createId();
    taskIdByKey.set(def.key, id);
    const task: Task = {
      id,
      projectId: def.projectId,
      columnId,
      status: columnSlug(def.column),
      title: def.title,
      description: "",
      position,
      number,
      priority: def.priority,
      createdAt: now,
      updatedAt: now,
    };
    if (def.startDaysFromNow !== undefined) {
      task.startDate = startDate(isoDaysFromNow(def.startDaysFromNow));
    }
    if (def.dueDaysFromNow !== undefined) {
      task.dueDate = isoDaysFromNow(def.dueDaysFromNow);
    }
    return task;
  });

  const projectDefs = [
    {
      id: websiteId,
      name: "Website relaunch",
      description: "Marketing site rebuild",
      position: 0,
    },
    {
      id: mobileId,
      name: "Mobile app",
      description: "iOS and Android client",
      position: 1,
    },
  ];
  const projects: Project[] = projectDefs.map((def) => ({
    id: def.id,
    name: def.name,
    slug: suggestProjectKey(def.name),
    description: def.description,
    icon: DEFAULT_PROJECT_ICON,
    position: def.position,
    lastTaskNumber: numberByProject.get(def.id) ?? 0,
    createdAt: now,
    updatedAt: now,
  }));

  // Demo palette per project plus a few assignments, so the label UI has real
  // data on first boot. The default palette used by real projects (and the
  // v3 upgrade backfill) is `buildDefaultLabels` below.
  const labelDefs = [
    { projectId: websiteId, name: "bug", color: "red" },
    { projectId: websiteId, name: "feature", color: "green" },
    { projectId: websiteId, name: "design", color: "purple" },
    { projectId: websiteId, name: "docs", color: "gray" },
    { projectId: mobileId, name: "crash", color: "red" },
    { projectId: mobileId, name: "sync", color: "teal" },
    { projectId: mobileId, name: "release", color: "yellow" },
  ];
  const labels: Label[] = labelDefs.map((def) => ({
    id: createId(),
    ...def,
    createdAt: now,
    updatedAt: now,
  }));
  const labelIdByKey = new Map(
    labels.map((label) => [`${label.projectId}:${label.name}`, label.id]),
  );

  const assignmentDefs = [
    ["web-1", websiteId, "design"],
    ["web-3", websiteId, "feature"],
    ["web-4", websiteId, "docs"],
    ["mob-3", mobileId, "crash"],
    ["mob-1", mobileId, "sync"],
    ["mob-4", mobileId, "release"],
  ] as const;
  const taskLabels: TaskLabel[] = assignmentDefs.map(
    ([taskKey, projectId, labelName]) => {
      const taskId = taskIdByKey.get(taskKey);
      const labelId = labelIdByKey.get(`${projectId}:${labelName}`);
      if (!taskId || !labelId) {
        throw new Error("Demo label assignment wiring mismatch.");
      }
      return { taskId, labelId };
    },
  );

  return { projects, columns, tasks, labels, taskLabels };
}

async function addSeedRows(db: SeedableDb, rows: SeedRows): Promise<void> {
  await db.projects.bulkAdd(rows.projects);
  await db.columns.bulkAdd(rows.columns);
  await db.tasks.bulkAdd(rows.tasks);
  await db.labels.bulkAdd(rows.labels);
  await db.taskLabels.bulkAdd(rows.taskLabels);
}

/** Runs inside the `populate` transaction on database creation. */
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
 * profiles whose projects predate labels. New projects create no labels
 * until the user does; the fresh-boot demo carries its own palette.
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
        id: createId(),
        projectId,
        ...entry,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return labels;
}
