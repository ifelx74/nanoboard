// In-memory mock data for the UI shell. Shapes intentionally match the
// future Dexie schema (see planned `src/lib/db/schema.ts`) so swapping the
// source later is a one-file change. No persistence yet.

export interface MockProject {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface MockColumn {
  id: string;
  projectId: string;
  name: string;
  position: number;
}

export type MockTaskPriority = "low" | "medium" | "high" | "urgent";

export interface MockTask {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description?: string;
  position: number;
  /** ISO date string (yyyy-mm-dd) */
  dueDate?: string;
  priority?: MockTaskPriority;
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const mockProjects: MockProject[] = [
  {
    id: "p-website",
    name: "Website relaunch",
    slug: "website-relaunch",
    description: "Marketing site rebuild",
  },
  {
    id: "p-mobile",
    name: "Mobile app",
    slug: "mobile-app",
    description: "iOS and Android client",
  },
];

export const mockColumns: MockColumn[] = [
  { id: "c-web-todo", projectId: "p-website", name: "To Do", position: 0 },
  { id: "c-web-progress", projectId: "p-website", name: "In Progress", position: 1 },
  { id: "c-web-review", projectId: "p-website", name: "In Review", position: 2 },
  { id: "c-web-done", projectId: "p-website", name: "Done", position: 3 },
  { id: "c-mob-todo", projectId: "p-mobile", name: "To Do", position: 0 },
  { id: "c-mob-progress", projectId: "p-mobile", name: "In Progress", position: 1 },
  { id: "c-mob-review", projectId: "p-mobile", name: "In Review", position: 2 },
  { id: "c-mob-done", projectId: "p-mobile", name: "Done", position: 3 },
];

export const mockTasks: MockTask[] = [
  {
    id: "t-1",
    projectId: "p-website",
    columnId: "c-web-todo",
    title: "Draft new homepage copy",
    position: 0,
    dueDate: isoDaysFromNow(2),
    priority: "medium",
  },
  {
    id: "t-2",
    projectId: "p-website",
    columnId: "c-web-todo",
    title: "Collect brand assets",
    position: 1,
    priority: "low",
  },
  {
    id: "t-3",
    projectId: "p-website",
    columnId: "c-web-progress",
    title: "Build pricing section",
    position: 0,
    dueDate: isoDaysFromNow(0),
    priority: "high",
  },
  {
    id: "t-4",
    projectId: "p-website",
    columnId: "c-web-review",
    title: "Migrate blog posts",
    position: 0,
    dueDate: isoDaysFromNow(5),
    priority: "medium",
  },
  {
    id: "t-5",
    projectId: "p-website",
    columnId: "c-web-done",
    title: "Set up staging deploy",
    position: 0,
    priority: "low",
  },
  {
    id: "t-6",
    projectId: "p-mobile",
    columnId: "c-mob-todo",
    title: "Design offline sync flow",
    position: 0,
    dueDate: isoDaysFromNow(3),
    priority: "urgent",
  },
  {
    id: "t-7",
    projectId: "p-mobile",
    columnId: "c-mob-progress",
    title: "Implement push notifications",
    position: 0,
    dueDate: isoDaysFromNow(1),
    priority: "high",
  },
  {
    id: "t-9",
    projectId: "p-mobile",
    columnId: "c-mob-review",
    title: "Fix login crash on Android 14",
    position: 0,
    dueDate: isoDaysFromNow(4),
    priority: "high",
  },
  {
    id: "t-8",
    projectId: "p-mobile",
    columnId: "c-mob-done",
    title: "Release 1.2 to TestFlight",
    position: 0,
    priority: "medium",
  },
];

export function getProject(projectId: string): MockProject | undefined {
  return mockProjects.find((p) => p.id === projectId);
}

export function getProjectColumns(projectId: string): MockColumn[] {
  return mockColumns
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => a.position - b.position);
}

export function getColumnTasks(columnId: string): MockTask[] {
  return mockTasks
    .filter((t) => t.columnId === columnId)
    .sort((a, b) => a.position - b.position);
}

export function getProjectTasks(projectId: string): MockTask[] {
  return mockTasks.filter((t) => t.projectId === projectId);
}
