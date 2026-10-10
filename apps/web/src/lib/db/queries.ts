import { createId } from "@paralleldrive/cuid2";
import Dexie from "dexie";
import { LABEL_COLORS } from "../label-color";
import { db } from "./db";
import type {
  Column,
  ColumnSlug,
  DueDateString,
  Label,
  Project,
  Task,
  TaskPriority,
} from "./schema";
import { TASK_PRIORITIES } from "./schema";

export function getProject(projectId: string): Promise<Project | undefined> {
  return db.projects.get(projectId);
}

export function getTask(id: string): Promise<Task | undefined> {
  return db.tasks.get(id);
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

const DUE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function assertValidTitle(title: string): string {
  const trimmed = title.trim();
  if (
    trimmed.length < QUICK_ADD_TITLE_MIN ||
    trimmed.length > QUICK_ADD_TITLE_MAX
  ) {
    throw new Error(
      `Title must be ${QUICK_ADD_TITLE_MIN}–${QUICK_ADD_TITLE_MAX} characters after trimming.`,
    );
  }
  return trimmed;
}

function assertValidPriority(priority: TaskPriority): void {
  if (!TASK_PRIORITIES.includes(priority)) {
    throw new Error(
      `Invalid priority "${priority}". Valid values: ${TASK_PRIORITIES.join(", ")}.`,
    );
  }
}

function assertValidDueDate(dueDate: DueDateString): void {
  const match = DUE_DATE_PATTERN.exec(dueDate);
  if (!match) {
    throw new Error(
      `Invalid due date "${dueDate}". Expected yyyy-mm-dd.`,
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error(`Invalid due date "${dueDate}". Not a real calendar date.`);
  }
}

async function requireTask(id: string): Promise<Task> {
  const task = await db.tasks.get(id);
  if (!task) {
    throw new Error("Task not found.");
  }
  return task;
}

async function nextColumnPosition(
  projectId: string,
  columnId: string,
): Promise<number> {
  const lastSibling = await db.tasks
    .where("[projectId+columnId+position]")
    .between(
      [projectId, columnId, Dexie.minKey],
      [projectId, columnId, Dexie.maxKey],
    )
    .last();
  return lastSibling ? lastSibling.position + 1 : 0;
}

export interface CreateTaskInput {
  projectId: string;
  columnId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: DueDateString | null;
  labelIds?: string[];
}

/**
 * Task creation write, from the title-only quick-add to the create dialog's
 * full write. The extra fields are all optional: description defaults to "",
 * priority to "no-priority", dueDate to absent, labels to none. Allocates `position`
 * (one past the last task in the destination column, read off the ordered
 * compound index) and `number` (project counter + 1) atomically in one
 * transaction that also bumps `project.lastTaskNumber` and attaches labels.
 * Throws on invalid titles or missing column/project; callers pre-guard the
 * title so the throw is unreachable defense-in-depth. Returns the new task id.
 */
export async function createTask(input: CreateTaskInput): Promise<string> {
  const title = assertValidTitle(input.title);
  if (input.priority !== undefined) assertValidPriority(input.priority);
  if (input.dueDate !== undefined && input.dueDate !== null) {
    assertValidDueDate(input.dueDate);
  }
  const now = Date.now();
  const id = createId();

  await db.transaction(
    "rw",
    db.tasks,
    db.projects,
    db.columns,
    db.taskLabels,
    db.labels,
    async () => {
      const column = await db.columns.get(input.columnId);
      if (!column || column.projectId !== input.projectId) {
        throw new Error("Destination column not found in this project.");
      }
      const project = await db.projects.get(input.projectId);
      if (!project) {
        throw new Error("Project not found.");
      }

      const labelIds = [...new Set(input.labelIds ?? [])];
      if (labelIds.length > 0) {
        const labels = await db.labels.bulkGet(labelIds);
        for (let i = 0; i < labelIds.length; i++) {
          const label = labels[i];
          if (!label) {
            throw new Error("Label not found.");
          }
          if (label.projectId !== input.projectId) {
            throw new Error("Label and task must belong to the same project.");
          }
        }
      }

      const position = await nextColumnPosition(input.projectId, input.columnId);
      const number = project.lastTaskNumber + 1;

      await db.tasks.add({
        id,
        projectId: input.projectId,
        columnId: input.columnId,
        status: column.slug,
        title,
        description: input.description ?? "",
        position,
        number,
        priority: input.priority ?? "no-priority",
        dueDate: input.dueDate ?? undefined,
        createdAt: now,
        updatedAt: now,
      });
      await db.projects.update(input.projectId, {
        lastTaskNumber: number,
        updatedAt: now,
      });
      for (const labelId of labelIds) {
        await db.taskLabels.put({ taskId: id, labelId });
      }
    },
  );

  return id;
}

export async function updateTaskTitle(id: string, title: string): Promise<void> {
  const trimmed = assertValidTitle(title);
  const existing = await requireTask(id);
  if (existing.title === trimmed) return;
  await db.tasks.update(id, { title: trimmed, updatedAt: Date.now() });
}

export async function updateTaskDescription(
  id: string,
  description: string,
): Promise<void> {
  await requireTask(id);
  await db.tasks.update(id, { description, updatedAt: Date.now() });
}

export async function updateTaskPriority(
  id: string,
  priority: TaskPriority,
): Promise<void> {
  assertValidPriority(priority);
  await requireTask(id);
  await db.tasks.update(id, { priority, updatedAt: Date.now() });
}

/**
 * A string sets the due date, `null` clears it. The `undefined` write
 * deletes the property from the stored row.
 */
export async function updateTaskDueDate(
  id: string,
  dueDate: DueDateString | null,
): Promise<void> {
  if (dueDate !== null) assertValidDueDate(dueDate);
  await requireTask(id);
  await db.tasks.update(id, { dueDate: dueDate ?? undefined, updatedAt: Date.now() });
}

/**
 * Same-project column move primitive (the future drag-and-drop drop
 * handler calls exactly this). Resolves the column by slug, syncs
 * `status` + `columnId`, appends `max+1`. Throws on missing task or
 * unknown slug.
 */
export async function moveTaskToColumn(
  id: string,
  slug: ColumnSlug,
): Promise<void> {
  await db.transaction("rw", db.tasks, db.columns, async () => {
    const task = await db.tasks.get(id);
    if (!task) {
      throw new Error("Task not found.");
    }
    const destination = await db.columns
      .where("projectId")
      .equals(task.projectId)
      .filter((candidate) => candidate.slug === slug)
      .first();
    if (!destination) {
      throw new Error(`Unknown column "${slug}" in this project.`);
    }
    const position = await nextColumnPosition(task.projectId, destination.id);
    await db.tasks.update(id, {
      columnId: destination.id,
      status: destination.slug,
      position,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Hard delete. Position gaps stay, the project counter never rewinds —
 * ticket numbers stay historically unique. Throws on missing task.
 */
export async function deleteTask(id: string): Promise<void> {
  await requireTask(id);
  await db.transaction("rw", db.tasks, db.taskLabels, async () => {
    await db.taskLabels.where("taskId").equals(id).delete();
    await db.tasks.delete(id);
  });
}

export interface ReorderItem {
  id: string;
  position: number;
  status?: ColumnSlug;
}

/**
 * Dense reorder write (the drag-and-drop drop handler calls exactly
 * this). Caller passes the new order; every item gets its position
 * (and, when `status` is present, its synced `status` + `columnId`).
 * Unique ids, integer positions, project-local columns, and
 * project membership are enforced; the write is one transaction.
 */
export async function reorderTasks(
  projectId: string,
  items: ReorderItem[],
): Promise<void> {
  const ids = items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Task IDs must be unique.");
  }
  for (const item of items) {
    if (!Number.isInteger(item.position) || item.position < 0) {
      throw new Error("Positions must be integers at or above 0.");
    }
  }

  const columns = await db.columns
    .where("projectId")
    .equals(projectId)
    .toArray();
  const columnBySlug = new Map(columns.map((column) => [column.slug, column]));
  for (const item of items) {
    if (item.status !== undefined && !columnBySlug.has(item.status)) {
      throw new Error(`Unknown column "${item.status}" in this project.`);
    }
  }

  const existing = await db.tasks.where("id").anyOf(ids).toArray();
  if (existing.length !== ids.length) {
    throw new Error("Tasks must belong to the requested project.");
  }
  for (const task of existing) {
    if (task.projectId !== projectId) {
      throw new Error("Tasks must belong to the requested project.");
    }
  }

  const now = Date.now();
  await db.transaction("rw", db.tasks, async () => {
    for (const item of items) {
      if (item.status === undefined) {
        await db.tasks.update(item.id, {
          position: item.position,
          updatedAt: now,
        });
      } else {
        const column = columnBySlug.get(item.status);
        if (!column) {
          throw new Error(`Unknown column "${item.status}" in this project.`);
        }
        await db.tasks.update(item.id, {
          position: item.position,
          status: item.status,
          columnId: column.id,
          updatedAt: now,
        });
      }
    }
  });
}

/**
 * Same-column copy with optional validated rename. Copies
 * description/priority/dueDate; mints fresh id, number, position, and
 * timestamps. Throws on missing source.
 */
export async function duplicateTask(
  sourceId: string,
  title?: string,
): Promise<string> {
  const trimmed = title === undefined ? undefined : assertValidTitle(title);
  const now = Date.now();
  const id = createId();

  await db.transaction("rw", db.tasks, db.projects, db.columns, async () => {
    const source = await db.tasks.get(sourceId);
    if (!source) {
      throw new Error("Task not found.");
    }
    const column = await db.columns.get(source.columnId);
    if (!column || column.projectId !== source.projectId) {
      throw new Error("Source column not found in this project.");
    }
    const project = await db.projects.get(source.projectId);
    if (!project) {
      throw new Error("Project not found.");
    }

    const position = await nextColumnPosition(source.projectId, source.columnId);
    const number = project.lastTaskNumber + 1;

    await db.tasks.add({
      id,
      projectId: source.projectId,
      columnId: source.columnId,
      status: source.status,
      title: trimmed ?? source.title,
      description: source.description,
      position,
      number,
      priority: source.priority,
      dueDate: source.dueDate,
      createdAt: now,
      updatedAt: now,
    });
    await db.projects.update(source.projectId, {
      lastTaskNumber: number,
      updatedAt: now,
    });
  });

  return id;
}

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
