import { db } from "./db";
import type { Column, Project, Task } from "./schema";

/**
 * Single data seam for routes. Async Dexie reads with mock-compatible
 * names/shapes so consumers subscribe via `useLiveQuery`. No CRUD here
 * beyond reads until ticket 04 lands the create path.
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
