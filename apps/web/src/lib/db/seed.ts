import { createId } from "@paralleldrive/cuid2";
import type { JSONContent } from "@tiptap/core";
import type Dexie from "dexie";
import type { Table } from "dexie";
import { extractContentText } from "../pages/document";
import { suggestProjectKey } from "../task-key";
import {
  DEFAULT_COLUMNS,
  DEFAULT_PROJECT_ICON,
  columnSlug,
  startDate,
} from "./schema";
import type {
  Column,
  ColumnSlug,
  DueDateString,
  Label,
  Page,
  PageAsset,
  PageContent,
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
  pages: Table<Page, string>;
  pageContents: Table<PageContent, string>;
  pageAssets: Table<PageAsset, string>;
}

export interface SeedRows {
  projects: Project[];
  columns: Column[];
  tasks: Task[];
  labels: Label[];
  taskLabels: TaskLabel[];
  pages: Page[];
  pageContents: PageContent[];
}

function headingNode(level: 1 | 2 | 3, text: string): JSONContent {
  return {
    type: "heading",
    attrs: { id: createId(), level },
    content: [{ type: "text", text }],
  };
}

function paragraphNode(text: string): JSONContent {
  return {
    type: "paragraph",
    attrs: { id: createId() },
    content: [{ type: "text", text }],
  };
}

function tableCellNode(
  type: "tableHeader" | "tableCell",
  text: string,
): JSONContent {
  return {
    type,
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [paragraphNode(text)],
  };
}

function buildWebsiteDemoPageContent(): JSONContent {
  return {
    type: "doc",
    content: [
      headingNode(1, "Launch Overview"),
      paragraphNode(
        "This document tracks the core milestones, release checklist, and technical guardrails for the Website relaunch.",
      ),
      {
        type: "callout",
        attrs: {
          id: createId(),
          logoType: "emoji",
          emoji: "💡",
          iconName: null,
          iconColor: null,
          backgroundColor: "light-blue",
        },
        content: [
          paragraphNode(
            "Target launch window is next Friday. Freeze marketing copy 48 hours before cutover so QA can verify every landing page.",
          ),
        ],
      },
      headingNode(2, "Launch Checklist"),
      {
        type: "taskList",
        attrs: { id: createId() },
        content: [
          {
            type: "taskItem",
            attrs: { checked: true },
            content: [paragraphNode("Configure staging deploy preview")],
          },
          {
            type: "taskItem",
            attrs: { checked: true },
            content: [paragraphNode("Finalize typography and color tokens")],
          },
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [paragraphNode("Complete pricing table responsiveness")],
          },
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [
              paragraphNode("Verify redirects for migrated blog posts"),
            ],
          },
        ],
      },
      headingNode(2, "Performance Budgets"),
      headingNode(3, "Page Targets"),
      {
        type: "table",
        attrs: { id: createId() },
        content: [
          {
            type: "tableRow",
            content: [
              tableCellNode("tableHeader", "Route"),
              tableCellNode("tableHeader", "Target LCP"),
              tableCellNode("tableHeader", "Status"),
            ],
          },
          {
            type: "tableRow",
            content: [
              tableCellNode("tableCell", "Homepage"),
              tableCellNode("tableCell", "< 1.4s"),
              tableCellNode("tableCell", "Ready"),
            ],
          },
          {
            type: "tableRow",
            content: [
              tableCellNode("tableCell", "Pricing"),
              tableCellNode("tableCell", "< 1.6s"),
              tableCellNode("tableCell", "In progress"),
            ],
          },
        ],
      },
      headingNode(3, "Redirect Helper"),
      {
        type: "codeBlock",
        attrs: { id: createId(), language: "typescript" },
        content: [
          {
            type: "text",
            text: `export interface RedirectRule {\n  from: string;\n  to: string;\n  permanent: boolean;\n}\n\nexport function resolveRedirect(\n  pathname: string,\n  rules: readonly RedirectRule[],\n): RedirectRule | undefined {\n  return rules.find((rule) => rule.from === pathname);\n}`,
          },
        ],
      },
    ],
  };
}

function buildMobileDemoPageContent(): JSONContent {
  return {
    type: "doc",
    content: [
      headingNode(1, "Release 1.3 Engineering Guide"),
      paragraphNode(
        "Key architectural notes, device verification tasks, and rollout steps for the upcoming iOS and Android build.",
      ),
      {
        type: "callout",
        attrs: {
          id: createId(),
          logoType: "emoji",
          emoji: "📱",
          iconName: null,
          iconColor: null,
          backgroundColor: "purple",
        },
        content: [
          paragraphNode(
            "Verify Android 14 cold-start behavior on a physical device before promoting the release candidate out of beta.",
          ),
        ],
      },
      headingNode(2, "Pre-Release Checklist"),
      {
        type: "taskList",
        attrs: { id: createId() },
        content: [
          {
            type: "taskItem",
            attrs: { checked: true },
            content: [paragraphNode("Ship 1.2 hotfix build to TestFlight")],
          },
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [paragraphNode("Audit offline queue retry backoff")],
          },
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [paragraphNode("Smoke-test push notification deep links")],
          },
        ],
      },
      headingNode(2, "Platform Matrix"),
      headingNode(3, "Minimum Supported OS"),
      {
        type: "table",
        attrs: { id: createId() },
        content: [
          {
            type: "tableRow",
            content: [
              tableCellNode("tableHeader", "Platform"),
              tableCellNode("tableHeader", "Minimum OS"),
              tableCellNode("tableHeader", "Channel"),
            ],
          },
          {
            type: "tableRow",
            content: [
              tableCellNode("tableCell", "iOS"),
              tableCellNode("tableCell", "iOS 16"),
              tableCellNode("tableCell", "TestFlight"),
            ],
          },
          {
            type: "tableRow",
            content: [
              tableCellNode("tableCell", "Android"),
              tableCellNode("tableCell", "Android 13"),
              tableCellNode("tableCell", "Internal Track"),
            ],
          },
        ],
      },
      headingNode(3, "Retry Backoff"),
      {
        type: "codeBlock",
        attrs: { id: createId(), language: "typescript" },
        content: [
          {
            type: "text",
            text: `export function nextRetryDelayMs(attempt: number): number {\n  const clamped = Math.max(0, Math.min(attempt, 6));\n  return Math.min(30_000, 500 * 2 ** clamped);\n}`,
          },
        ],
      },
    ],
  };
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

  const websitePageId = createId();
  const websitePageJson = buildWebsiteDemoPageContent();
  const mobilePageId = createId();
  const mobilePageJson = buildMobileDemoPageContent();

  const pages: Page[] = [
    {
      id: websitePageId,
      projectId: websiteId,
      title: "Launch Plan & Architecture",
      logo: { type: "emoji", value: "🚀" },
      isFavorite: true,
      isLocked: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: mobilePageId,
      projectId: mobileId,
      title: "Offline Storage & Release Guide",
      logo: { type: "emoji", value: "📱" },
      isFavorite: false,
      isLocked: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const pageContents: PageContent[] = [
    {
      pageId: websitePageId,
      projectId: websiteId,
      contentJson: websitePageJson,
      contentText: extractContentText(websitePageJson),
    },
    {
      pageId: mobilePageId,
      projectId: mobileId,
      contentJson: mobilePageJson,
      contentText: extractContentText(mobilePageJson),
    },
  ];

  return {
    projects,
    columns,
    tasks,
    labels,
    taskLabels,
    pages,
    pageContents,
  };
}

async function addSeedRows(db: SeedableDb, rows: SeedRows): Promise<void> {
  await db.projects.bulkAdd(rows.projects);
  await db.columns.bulkAdd(rows.columns);
  await db.tasks.bulkAdd(rows.tasks);
  await db.labels.bulkAdd(rows.labels);
  await db.taskLabels.bulkAdd(rows.taskLabels);
  await db.pages.bulkAdd(rows.pages);
  await db.pageContents.bulkAdd(rows.pageContents);
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
    [
      db.projects,
      db.columns,
      db.tasks,
      db.labels,
      db.taskLabels,
      db.pages,
      db.pageContents,
      db.pageAssets,
    ],
    async () => {
      await db.taskLabels.clear();
      await db.tasks.clear();
      await db.labels.clear();
      await db.columns.clear();
      await db.pageAssets.clear();
      await db.pageContents.clear();
      await db.pages.clear();
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
