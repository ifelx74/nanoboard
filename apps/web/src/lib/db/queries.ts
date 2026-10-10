import { createId } from "@paralleldrive/cuid2";
import { db } from "./db";
import type { Column, Project, Task } from "./schema";

/**
 * Single data seam for routes. Async Dexie reads with mock-compatible
 * names/shapes so consumers subscribe via `useLiveQuery`, plus the
 * quick-add write path (ticket 04).
 */
export function getProject(projectId: string): Promise<Project | undefined> {
  return db.projects.get(projectId);
}

export function getProjectColumns(projectId: string): Promise<Column[]> {
  return db.columns.where("projectId").equals(projectId).sortBy("position");
}

export function getColumnTasks(columnId: string): Promise<Task[]> {
  return db.tasks.where("columnId").equals(columnId).sortBy("position");
}

export function getProjectTasks(projectId: string): Promise<Task[]> {
  return db.tasks.where("projectId").equals(projectId).toArray();
}

export function getProjects(): Promise<Project[]> {
  return db.projects.orderBy("position").toArray();
}

export function getAllTasks(): Promise<Task[]> {
  return db.tasks.toArray();
}

export const QUICK_ADD_TITLE_MIN = 3;
export const QUICK_ADD_TITLE_MAX = 256;

export interface CreateTaskInput {
  projectId: string;
  columnId: string;
  title: string;
}

/**
 * Title-only quick-add write. Allocates `position` (max in the destination
 * column + 1) and `number` (project counter + 1) atomically in one
 * transaction that also bumps `project.lastTaskNumber`. Throws on invalid
 * titles or missing column/project; callers pre-guard the title so the
 * throw is unreachable defense-in-depth. Returns the new task id.
 */
export async function createTask(input: CreateTaskInput): Promise<string> {
  const title = input.title.trim();
  if (
    title.length < QUICK_ADD_TITLE_MIN ||
    title.length > QUICK_ADD_TITLE_MAX
  ) {
    throw new Error(
      `Title must be ${QUICK_ADD_TITLE_MIN}–${QUICK_ADD_TITLE_MAX} characters after trimming.`,
    );
  }

  const now = Date.now();
  const id = createId();

  await db.transaction("rw", db.tasks, db.projects, db.columns, async () => {
    const column = await db.columns.get(input.columnId);
    if (!column || column.projectId !== input.projectId) {
      throw new Error("Destination column not found in this project.");
    }
    const project = await db.projects.get(input.projectId);
    if (!project) {
      throw new Error("Project not found.");
    }

    const siblings = await db.tasks
      .where("[projectId+columnId]")
      .equals([input.projectId, input.columnId])
      .toArray();
    const position =
      siblings.length === 0
        ? 0
        : Math.max(...siblings.map((task) => task.position)) + 1;
    const number = project.lastTaskNumber + 1;

    await db.tasks.add({
      id,
      projectId: input.projectId,
      columnId: input.columnId,
      status: column.slug,
      title,
      description: "",
      position,
      number,
      priority: "no-priority",
      createdAt: now,
      updatedAt: now,
    });
    await db.projects.update(input.projectId, {
      lastTaskNumber: number,
      updatedAt: now,
    });
  });

  return id;
}
