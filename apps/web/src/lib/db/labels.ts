import { createId } from "@paralleldrive/cuid2";
import { LABEL_COLORS } from "../label-color";
import { db } from "./db";
import type { Label } from "./schema";

export const LABEL_NAME_MIN = 1;
export const LABEL_NAME_MAX = 60;

function assertValidLabelName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < LABEL_NAME_MIN || trimmed.length > LABEL_NAME_MAX) {
    throw new Error(
      `Label name must be ${LABEL_NAME_MIN}–${LABEL_NAME_MAX} characters after trimming.`,
    );
  }
  return trimmed;
}

function assertValidLabelColor(color: string): void {
  if (!LABEL_COLORS.some((candidate) => candidate.value === color)) {
    throw new Error(
      `Invalid label color "${color}". Valid values: ${LABEL_COLORS.map((candidate) => candidate.value).join(", ")}.`,
    );
  }
}

async function requireLabel(id: string): Promise<Label> {
  const label = await db.labels.get(id);
  if (!label) {
    throw new Error("Label not found.");
  }
  return label;
}

/**
 * The `&[projectId+name]` index is case-sensitive, so case-insensitive
 * uniqueness is checked explicitly inside the write transaction.
 */
async function assertUniqueLabelName(
  projectId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const siblings = await db.labels.where("projectId").equals(projectId).toArray();
  const clash = siblings.some(
    (sibling) =>
      sibling.id !== exceptId &&
      sibling.name.toLowerCase() === name.toLowerCase(),
  );
  if (clash) {
    throw new Error(`A label named "${name}" already exists in this project.`);
  }
}

export function getProjectLabels(projectId: string): Promise<Label[]> {
  return db.labels.where("projectId").equals(projectId).toArray();
}

export async function getTaskLabels(taskId: string): Promise<Label[]> {
  const joins = await db.taskLabels.where("taskId").equals(taskId).toArray();
  return resolveLabels(joins.map((join) => join.labelId));
}

/**
 * Project-wide assignment map backing board chips (and the ticket-5
 * filter): one live subscription instead of one per card. Tasks without
 * labels are absent from the map.
 */
export async function getProjectTaskLabels(
  projectId: string,
): Promise<Map<string, Label[]>> {
  const tasks = await db.tasks.where("projectId").equals(projectId).toArray();
  if (tasks.length === 0) return new Map();
  const joins = await db.taskLabels
    .where("taskId")
    .anyOf(tasks.map((task) => task.id))
    .toArray();
  if (joins.length === 0) return new Map();
  const byId = await resolveLabelMap([
    ...new Set(joins.map((join) => join.labelId)),
  ]);
  const byTask = new Map<string, Label[]>();
  for (const join of joins) {
    const label = byId.get(join.labelId);
    if (!label) continue;
    const list = byTask.get(join.taskId) ?? [];
    list.push(label);
    byTask.set(join.taskId, list);
  }
  return byTask;
}

async function resolveLabels(labelIds: string[]): Promise<Label[]> {
  return [...(await resolveLabelMap(labelIds)).values()];
}

async function resolveLabelMap(
  labelIds: string[],
): Promise<Map<string, Label>> {
  if (labelIds.length === 0) return new Map();
  const labels = await db.labels.bulkGet(labelIds);
  return new Map(
    labels
      .filter((label): label is Label => label !== undefined)
      .map((label) => [label.id, label]),
  );
}

export async function createLabel(
  projectId: string,
  name: string,
  color: string,
): Promise<string> {
  const trimmed = assertValidLabelName(name);
  assertValidLabelColor(color);
  const now = Date.now();
  const id = createId();

  await db.transaction("rw", db.labels, db.projects, async () => {
    const project = await db.projects.get(projectId);
    if (!project) {
      throw new Error("Project not found.");
    }
    await assertUniqueLabelName(projectId, trimmed);
    await db.labels.add({
      id,
      projectId,
      name: trimmed,
      color,
      createdAt: now,
      updatedAt: now,
    });
  });

  return id;
}

export async function renameLabel(id: string, name: string): Promise<void> {
  const trimmed = assertValidLabelName(name);
  await db.transaction("rw", db.labels, async () => {
    const existing = await db.labels.get(id);
    if (!existing) {
      throw new Error("Label not found.");
    }
    if (existing.name === trimmed) return;
    await assertUniqueLabelName(existing.projectId, trimmed, id);
    await db.labels.update(id, { name: trimmed, updatedAt: Date.now() });
  });
}

export async function updateLabelColor(
  id: string,
  color: string,
): Promise<void> {
  assertValidLabelColor(color);
  await requireLabel(id);
  await db.labels.update(id, { color, updatedAt: Date.now() });
}

/**
 * Deletes the palette entry plus its assignments in one transaction.
 * Throws on missing label.
 */
export async function deleteLabel(id: string): Promise<void> {
  await requireLabel(id);
  await db.transaction("rw", db.labels, db.taskLabels, async () => {
    await db.taskLabels.where("labelId").equals(id).delete();
    await db.labels.delete(id);
  });
}

/**
 * Attaches a palette label to a task. Same-project membership is enforced;
 * re-attaching an existing pair is a store-level no-op via the compound key.
 */
export async function attachLabel(
  taskId: string,
  labelId: string,
): Promise<void> {
  await db.transaction("rw", db.tasks, db.labels, db.taskLabels, async () => {
    const task = await db.tasks.get(taskId);
    if (!task) {
      throw new Error("Task not found.");
    }
    const label = await db.labels.get(labelId);
    if (!label) {
      throw new Error("Label not found.");
    }
    if (label.projectId !== task.projectId) {
      throw new Error("Label and task must belong to the same project.");
    }
    await db.taskLabels.put({ taskId, labelId });
  });
}

/** Detaching a missing pair is a no-op, never an error. */
export async function detachLabel(
  taskId: string,
  labelId: string,
): Promise<void> {
  await db.taskLabels.delete([taskId, labelId]);
}

