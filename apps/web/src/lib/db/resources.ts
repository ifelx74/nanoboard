import { createId } from "@paralleldrive/cuid2";
import { db } from "./db";
import type { TaskResource } from "./schema";

export const RESOURCE_TITLE_MAX = 200;

const MANUAL_RESOURCE_TYPE = "url";

function assertValidResourceUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Resource URL is required.");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Resource URL must be a valid http or https URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Resource URL must use http or https.");
  }
  return trimmed;
}

function normalizeResourceTitle(raw: string | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length > RESOURCE_TITLE_MAX) {
    throw new Error(
      `Resource title must be ${RESOURCE_TITLE_MAX} characters or fewer.`,
    );
  }
  return trimmed;
}

export async function getTaskResources(
  taskId: string,
): Promise<TaskResource[]> {
  const rows = await db.taskResources.where("taskId").equals(taskId).toArray();
  rows.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
  return rows;
}

export async function createTaskResource(
  taskId: string,
  input: { url: string; title?: string },
): Promise<string> {
  const url = assertValidResourceUrl(input.url);
  const title = normalizeResourceTitle(input.title);
  const now = Date.now();
  const id = createId();

  await db.transaction("rw", db.tasks, db.taskResources, async () => {
    const task = await db.tasks.get(taskId);
    if (!task) {
      throw new Error("Task not found.");
    }
    await db.taskResources.add({
      id,
      taskId,
      resourceType: MANUAL_RESOURCE_TYPE,
      externalId: url,
      url,
      title,
      createdAt: now,
      updatedAt: now,
    });
  });

  return id;
}

export async function deleteTaskResource(
  taskId: string,
  id: string,
): Promise<void> {
  await db.transaction("rw", db.taskResources, async () => {
    const existing = await db.taskResources.get(id);
    if (
      !existing ||
      existing.taskId !== taskId ||
      existing.resourceType !== MANUAL_RESOURCE_TYPE
    ) {
      throw new Error("Resource not found.");
    }
    await db.taskResources.delete(id);
  });
}
