import { createId } from "@paralleldrive/cuid2";
import { LABEL_COLORS } from "../label-color";
import type { NanoboardDB } from "./db";
import { isTaskArchived } from "./archive";
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

async function requireLabel(database: NanoboardDB, id: string): Promise<Label> {
  const label = await database.labels.get(id);
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
  database: NanoboardDB,
  projectId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const siblings = await database.labels
    .where("projectId")
    .equals(projectId)
    .toArray();
  const clash = siblings.some(
    (sibling) =>
      sibling.id !== exceptId &&
      sibling.name.toLowerCase() === name.toLowerCase(),
  );
  if (clash) {
    throw new Error(`A label named "${name}" already exists in this project.`);
  }
}

export function getProjectLabels(
  database: NanoboardDB,
  projectId: string,
): Promise<Label[]> {
  return database.labels.where("projectId").equals(projectId).toArray();
}

export async function getTaskLabels(
  database: NanoboardDB,
  taskId: string,
): Promise<Label[]> {
  const joins = await database.taskLabels
    .where("taskId")
    .equals(taskId)
    .toArray();
  return resolveLabels(
    database,
    joins.map((join) => join.labelId),
  );
}

export interface GetProjectTaskLabelsOptions {
  /** Transfer/export reads opt back in; see GetProjectTasksOptions. */
  includeArchived?: boolean;
}

/**
 * Project-wide assignment map backing board chips (and the ticket-5
 * filter): one live subscription instead of one per task. The join runs
 * off the project's active tasks — archived rows are excluded via the
 * shared archive predicate unless the caller opts in. Tasks without
 * labels are absent from the map.
 */
export async function getProjectTaskLabels(
  database: NanoboardDB,
  projectId: string,
  options?: GetProjectTaskLabelsOptions,
): Promise<Map<string, Label[]>> {
  const tasks = await database.tasks
    .where("projectId")
    .equals(projectId)
    .toArray();
  const visible = options?.includeArchived
    ? tasks
    : tasks.filter((task) => !isTaskArchived(task));
  if (visible.length === 0) return new Map();
  const joins = await database.taskLabels
    .where("taskId")
    .anyOf(visible.map((task) => task.id))
    .toArray();
  if (joins.length === 0) return new Map();
  const byId = await resolveLabelMap(database, [
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

async function resolveLabels(
  database: NanoboardDB,
  labelIds: string[],
): Promise<Label[]> {
  return [...(await resolveLabelMap(database, labelIds)).values()];
}

async function resolveLabelMap(
  database: NanoboardDB,
  labelIds: string[],
): Promise<Map<string, Label>> {
  if (labelIds.length === 0) return new Map();
  const labels = await database.labels.bulkGet(labelIds);
  return new Map(
    labels
      .filter((label): label is Label => label !== undefined)
      .map((label) => [label.id, label]),
  );
}

export async function createLabel(
  database: NanoboardDB,
  projectId: string,
  name: string,
  color: string,
): Promise<string> {
  const trimmed = assertValidLabelName(name);
  assertValidLabelColor(color);
  const now = Date.now();
  const id = createId();

  await database.transaction(
    "rw",
    database.labels,
    database.projects,
    async () => {
      const project = await database.projects.get(projectId);
      if (!project) {
        throw new Error("Project not found.");
      }
      await assertUniqueLabelName(database, projectId, trimmed);
      await database.labels.add({
        id,
        projectId,
        name: trimmed,
        color,
        createdAt: now,
        updatedAt: now,
      });
    },
  );

  return id;
}

export async function renameLabel(
  database: NanoboardDB,
  id: string,
  name: string,
): Promise<void> {
  const trimmed = assertValidLabelName(name);
  await database.transaction("rw", database.labels, async () => {
    const existing = await database.labels.get(id);
    if (!existing) {
      throw new Error("Label not found.");
    }
    if (existing.name === trimmed) return;
    await assertUniqueLabelName(database, existing.projectId, trimmed, id);
    await database.labels.update(id, { name: trimmed, updatedAt: Date.now() });
  });
}

export async function updateLabelColor(
  database: NanoboardDB,
  id: string,
  color: string,
): Promise<void> {
  assertValidLabelColor(color);
  await requireLabel(database, id);
  await database.labels.update(id, { color, updatedAt: Date.now() });
}

/**
 * Deletes the palette entry plus its assignments in one transaction.
 * Throws on missing label.
 */
export async function deleteLabel(
  database: NanoboardDB,
  id: string,
): Promise<void> {
  await database.transaction(
    "rw",
    database.labels,
    database.taskLabels,
    async () => {
      await requireLabel(database, id);
      await database.taskLabels.where("labelId").equals(id).delete();
      await database.labels.delete(id);
    },
  );
}

/**
 * Attaches a palette label to a task. Same-project membership is enforced;
 * re-attaching an existing pair is a store-level no-op via the compound key.
 */
export async function attachLabel(
  database: NanoboardDB,
  taskId: string,
  labelId: string,
): Promise<void> {
  await database.transaction(
    "rw",
    database.tasks,
    database.labels,
    database.taskLabels,
    async () => {
      const task = await database.tasks.get(taskId);
      if (!task) {
        throw new Error("Task not found.");
      }
      const label = await database.labels.get(labelId);
      if (!label) {
        throw new Error("Label not found.");
      }
      if (label.projectId !== task.projectId) {
        throw new Error("Label and task must belong to the same project.");
      }
      await database.taskLabels.put({ taskId, labelId });
    },
  );
}

/** Detaching a missing pair is a no-op, never an error. */
export async function detachLabel(
  database: NanoboardDB,
  taskId: string,
  labelId: string,
): Promise<void> {
  await database.taskLabels.delete([taskId, labelId]);
}
