import { createId } from "@paralleldrive/cuid2";
import Dexie from "dexie";
import { db } from "./db";
import type { Column, Project, Task } from "./schema";

/**
 * Single data seam for routes. Async Dexie reads so consumers subscribe
 * via `useLiveQuery`, plus the quick-add write path.
 */
export function getProject(projectId: string): Promise<Project | undefined> {
  return db.projects.get(projectId);
}

export function getProjectColumns(projectId: string): Promise<Column[]> {
  return db.columns.where("projectId").equals(projectId).sortBy("position");
}

export function getProjectTasks(projectId: string): Promise<Task[]> {
  return db.tasks.where("projectId").equals(projectId).toArray();
}

export function getProjects(): Promise<Project[]> {
  return db.projects.orderBy("position").toArray();
}

export function countProjectTasks(projectId: string): Promise<number> {
  return db.tasks.where("projectId").equals(projectId).count();
}

export const QUICK_ADD_TITLE_MIN = 3;
export const QUICK_ADD_TITLE_MAX = 256;

export interface CreateTaskInput {
  projectId: string;
  columnId: string;
  title: string;
}

/**
 * Title-only quick-add write. Allocates `position` (one past the last task
 * in the destination column, read off the ordered compound index) and
 * `number` (project counter + 1) atomically in one transaction that also
 * bumps `project.lastTaskNumber`. Throws on invalid titles or missing
 * column/project; callers pre-guard the title so the throw is unreachable
 * defense-in-depth. Returns the new task id.
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

    const lastSibling = await db.tasks
      .where("[projectId+columnId+position]")
      .between(
        [input.projectId, input.columnId, Dexie.minKey],
        [input.projectId, input.columnId, Dexie.maxKey],
      )
      .last();
    const position = lastSibling ? lastSibling.position + 1 : 0;
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
