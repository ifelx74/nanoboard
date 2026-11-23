import { createId } from "@paralleldrive/cuid2";
import Dexie from "dexie";
import type { NanoboardDB } from "./db";
import { isTaskArchived } from "./archive";
import type {
  Column,
  ColumnSlug,
  DueDateString,
  StartDateString,
  Task,
  TaskPriority,
} from "./schema";
import { TASK_PRIORITIES } from "./schema";

export function getTask(
  database: NanoboardDB,
  id: string,
): Promise<Task | undefined> {
  return database.tasks.get(id);
}

export function getProjectColumns(
  database: NanoboardDB,
  projectId: string,
): Promise<Column[]> {
  return database.columns
    .where("projectId")
    .equals(projectId)
    .sortBy("position");
}

export interface GetProjectTasksOptions {
  /**
   * Transfer/export reads must carry archive state (interchange fidelity —
   * see the task-transfer format), so they opt back in; every work surface
   * reads active tasks only by default.
   */
  includeArchived?: boolean;
}

/**
 * Active-task listing for the board/list/calendar surfaces: archived rows
 * are excluded via the shared archive predicate unless the caller opts in.
 */
export async function getProjectTasks(
  database: NanoboardDB,
  projectId: string,
  options?: GetProjectTasksOptions,
): Promise<Task[]> {
  const tasks = await database.tasks
    .where("projectId")
    .equals(projectId)
    .toArray();
  return options?.includeArchived
    ? tasks
    : tasks.filter((task) => !isTaskArchived(task));
}

/** Active-task count backing task-count badges; archived rows excluded. */
export function countProjectTasks(
  database: NanoboardDB,
  projectId: string,
): Promise<number> {
  return database.tasks
    .where("projectId")
    .equals(projectId)
    .filter((task) => !isTaskArchived(task))
    .count();
}

/** An open task with the project key joined on, as the week strip needs it. */
export interface OpenTask extends Task {
  projectSlug: string;
}

/**
 * Open (non-archived, non-final-column) tasks due within the inclusive
 * `yyyy-mm-dd` window, across all projects. The indexed `dueDate` range
 * keeps the result set to the week at hand instead of the whole task table
 * — far-future and undated tasks never serialize into the live query.
 * Callers bucket the returned rows by due day.
 */
export async function getOpenTasks(
  database: NanoboardDB,
  from: DueDateString,
  to: DueDateString,
): Promise<OpenTask[]> {
  const [columns, projects, tasks] = await Promise.all([
    database.columns.toArray(),
    database.projects.toArray(),
    database.tasks.where("dueDate").between(from, to, true, true).toArray(),
  ]);
  const finalIds = new Set(
    columns.filter((column) => column.isFinal).map((column) => column.id),
  );
  const slugByProject = new Map(
    projects.map((project) => [project.id, project.slug]),
  );
  const open: OpenTask[] = [];
  for (const task of tasks) {
    if (isTaskArchived(task) || finalIds.has(task.columnId)) continue;
    const projectSlug = slugByProject.get(task.projectId);
    if (projectSlug === undefined) continue;
    open.push({ ...task, projectSlug });
  }
  return open;
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

function assertValidDayDate(value: string, field: string): void {
  const match = DUE_DATE_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid ${field} "${value}". Expected yyyy-mm-dd.`);
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
    throw new Error(`Invalid ${field} "${value}". Not a real calendar date.`);
  }
}

function assertValidDueDate(dueDate: DueDateString): void {
  assertValidDayDate(dueDate, "due date");
}

function assertValidStartDate(startDate: StartDateString): void {
  assertValidDayDate(startDate, "start date");
}

/**
 * Mirrors `validateDateRange`: a start after the due date is
 * rejected, never swapped or clamped. Day strings compare
 * lexicographically in yyyy-mm-dd form.
 */
function assertValidDateRange(
  startDate: StartDateString | undefined,
  dueDate: DueDateString | undefined,
): void {
  if (
    startDate !== undefined &&
    dueDate !== undefined &&
    String(startDate) > String(dueDate)
  ) {
    throw new Error("Start date cannot be after due date.");
  }
}

async function requireTask(database: NanoboardDB, id: string): Promise<Task> {
  const task = await database.tasks.get(id);
  if (!task) {
    throw new Error("Task not found.");
  }
  return task;
}

async function nextColumnPosition(
  database: NanoboardDB,
  projectId: string,
  columnId: string,
): Promise<number> {
  const lastSibling = await database.tasks
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
  startDate?: StartDateString | null;
  dueDate?: DueDateString | null;
  labelIds?: string[];
}

/**
 * Task creation write, from the title-only quick-add to the create dialog's
 * full write. The extra fields are all optional: description defaults to "",
 * priority to "no-priority", dates to absent, labels to none. Allocates `position`
 * (one past the last task in the destination column, read off the ordered
 * compound index) and `number` (project counter + 1) atomically in one
 * transaction that also bumps `project.lastTaskNumber` and attaches labels.
 * Throws on invalid titles, malformed dates, a start after the due date, or
 * missing column/project; callers pre-guard the title so the throw is
 * unreachable defense-in-depth. Returns the new task id.
 */
export async function createTask(
  database: NanoboardDB,
  input: CreateTaskInput,
): Promise<string> {
  const title = assertValidTitle(input.title);
  if (input.priority !== undefined) assertValidPriority(input.priority);
  if (input.startDate !== undefined && input.startDate !== null) {
    assertValidStartDate(input.startDate);
  }
  if (input.dueDate !== undefined && input.dueDate !== null) {
    assertValidDueDate(input.dueDate);
  }
  assertValidDateRange(
    input.startDate ?? undefined,
    input.dueDate ?? undefined,
  );
  const now = Date.now();
  const id = createId();

  await database.transaction(
    "rw",
    database.tasks,
    database.projects,
    database.columns,
    database.taskLabels,
    database.labels,
    async () => {
      const column = await database.columns.get(input.columnId);
      if (!column || column.projectId !== input.projectId) {
        throw new Error("Destination column not found in this project.");
      }
      const project = await database.projects.get(input.projectId);
      if (!project) {
        throw new Error("Project not found.");
      }

      const labelIds = [...new Set(input.labelIds ?? [])];
      if (labelIds.length > 0) {
        const labels = await database.labels.bulkGet(labelIds);
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

      const position = await nextColumnPosition(
        database,
        input.projectId,
        input.columnId,
      );
      const number = project.lastTaskNumber + 1;

      await database.tasks.add({
        id,
        projectId: input.projectId,
        columnId: input.columnId,
        status: column.slug,
        title,
        description: input.description ?? "",
        position,
        number,
        priority: input.priority ?? "no-priority",
        startDate: input.startDate ?? undefined,
        dueDate: input.dueDate ?? undefined,
        createdAt: now,
        updatedAt: now,
      });
      await database.projects.update(input.projectId, {
        lastTaskNumber: number,
        updatedAt: now,
      });
      for (const labelId of labelIds) {
        await database.taskLabels.put({ taskId: id, labelId });
      }
    },
  );

  return id;
}

export async function updateTaskTitle(
  database: NanoboardDB,
  id: string,
  title: string,
): Promise<void> {
  const trimmed = assertValidTitle(title);
  const existing = await requireTask(database, id);
  if (existing.title === trimmed) return;
  await database.tasks.update(id, { title: trimmed, updatedAt: Date.now() });
}

export async function updateTaskDescription(
  database: NanoboardDB,
  id: string,
  description: string,
): Promise<void> {
  await requireTask(database, id);
  await database.tasks.update(id, { description, updatedAt: Date.now() });
}

export async function updateTaskPriority(
  database: NanoboardDB,
  id: string,
  priority: TaskPriority,
): Promise<void> {
  assertValidPriority(priority);
  await requireTask(database, id);
  await database.tasks.update(id, { priority, updatedAt: Date.now() });
}

const MS_PER_DAY = 86_400_000;

function parseDayNumberUtc(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(
    Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / MS_PER_DAY,
  );
}

/**
 * DST-safe UTC calendar day shift for `yyyy-mm-dd` strings. Shifted outputs
 * are re-validated by `assertValidStartDate` / `assertValidDueDate` so year
 * overflows reject loudly.
 */
function shiftDayString(value: string, dayDelta: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(
    Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + dayDelta),
  );
  const y = String(shifted.getUTCFullYear()).padStart(4, "0");
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type TaskRescheduleMode = "move" | "resize-start" | "resize-end";

/**
 * Unified transactional Timeline reschedule write: handles whole-bar moves and
 * start/end edge resizes in a single transaction against the persisted row.
 * - `move`: shifts every existing date by `dayDelta` (duration preserved).
 * - `resize-start` / `resize-end`: moves the dragged edge clamped to at least a
 *   1-day bar (`start <= due`); on a single-dated bar, dragging the absent edge
 *   creates the missing endpoint anchored to the existing date.
 * An undated task, zero delta, or clamped no-op writes nothing and leaves
 * `updatedAt` untouched. Throws on a missing task, non-integer delta, or
 * invalid/inverted stored dates.
 */
export async function rescheduleTask(
  database: NanoboardDB,
  id: string,
  mode: TaskRescheduleMode,
  dayDelta: number,
): Promise<void> {
  if (!Number.isInteger(dayDelta)) {
    throw new Error(`dayDelta must be an integer. Received ${dayDelta}.`);
  }
  if (dayDelta === 0) return;

  await database.transaction("rw", database.tasks, async () => {
    const task = await database.tasks.get(id);
    if (!task) {
      throw new Error("Task not found.");
    }
    if (task.startDate !== undefined) assertValidStartDate(task.startDate);
    if (task.dueDate !== undefined) assertValidDueDate(task.dueDate);

    if (task.startDate === undefined && task.dueDate === undefined) {
      return;
    }
    assertValidDateRange(task.startDate, task.dueDate);

    const patch: {
      startDate?: StartDateString;
      dueDate?: DueDateString;
    } = {};

    if (mode === "move") {
      if (task.startDate !== undefined) {
        const value = shiftDayString(task.startDate, dayDelta);
        assertValidStartDate(value as StartDateString);
        patch.startDate = value as StartDateString;
      }
      if (task.dueDate !== undefined) {
        const value = shiftDayString(task.dueDate, dayDelta);
        assertValidDueDate(value as DueDateString);
        patch.dueDate = value as DueDateString;
      }
      assertValidDateRange(patch.startDate, patch.dueDate);
    } else {
      const spanDays =
        task.startDate !== undefined && task.dueDate !== undefined
          ? parseDayNumberUtc(task.dueDate) -
            parseDayNumberUtc(task.startDate) +
            1
          : 1;
      const maxShrink = spanDays - 1;
      if (mode === "resize-start") {
        const effectiveDelta = Math.min(dayDelta, maxShrink);
        const anchor = task.startDate ?? task.dueDate!;
        const value = shiftDayString(anchor, effectiveDelta);
        if (value === task.startDate) return;
        assertValidStartDate(value as StartDateString);
        assertValidDateRange(value as StartDateString, task.dueDate);
        patch.startDate = value as StartDateString;
      } else {
        const effectiveDelta = Math.max(dayDelta, -maxShrink);
        const anchor = task.dueDate ?? task.startDate!;
        const value = shiftDayString(anchor, effectiveDelta);
        if (value === task.dueDate) return;
        assertValidDueDate(value as DueDateString);
        assertValidDateRange(task.startDate, value as DueDateString);
        patch.dueDate = value as DueDateString;
      }
    }

    await database.tasks.update(id, {
      ...patch,
      updatedAt: Date.now(),
    });
  });
}

/**
 * A string sets the start date, `null` clears it. Runs transactionally and
 * rejects a start after the task's current due date.
 */
export async function updateTaskStartDate(
  database: NanoboardDB,
  id: string,
  startDate: StartDateString | null,
): Promise<void> {
  if (startDate !== null) assertValidStartDate(startDate);
  await database.transaction("rw", database.tasks, async () => {
    const existing = await requireTask(database, id);
    assertValidDateRange(startDate ?? undefined, existing.dueDate);
    await database.tasks.update(id, {
      startDate: startDate ?? undefined,
      updatedAt: Date.now(),
    });
  });
}

/**
 * A string sets the due date, `null` clears it. Runs transactionally and
 * rejects a due before the task's current start date.
 */
export async function updateTaskDueDate(
  database: NanoboardDB,
  id: string,
  dueDate: DueDateString | null,
): Promise<void> {
  if (dueDate !== null) assertValidDueDate(dueDate);
  await database.transaction("rw", database.tasks, async () => {
    const existing = await requireTask(database, id);
    assertValidDateRange(existing.startDate, dueDate ?? undefined);
    await database.tasks.update(id, {
      dueDate: dueDate ?? undefined,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Same-project column move primitive (the future drag-and-drop drop
 * handler calls exactly this). Resolves the column by slug, syncs
 * `status` + `columnId`, appends `max+1`. Throws on missing task or
 * unknown slug.
 */
export async function moveTaskToColumn(
  database: NanoboardDB,
  id: string,
  slug: ColumnSlug,
): Promise<void> {
  await database.transaction(
    "rw",
    database.tasks,
    database.columns,
    async () => {
      const task = await database.tasks.get(id);
      if (!task) {
        throw new Error("Task not found.");
      }
      const destination = await database.columns
        .where("projectId")
        .equals(task.projectId)
        .filter((candidate) => candidate.slug === slug)
        .first();
      if (!destination) {
        throw new Error(`Unknown column "${slug}" in this project.`);
      }
      const position = await nextColumnPosition(
        database,
        task.projectId,
        destination.id,
      );
      await database.tasks.update(id, {
        columnId: destination.id,
        status: destination.slug,
        position,
        updatedAt: Date.now(),
      });
    },
  );
}

/**
 * Hard delete. Position gaps stay, the project counter never rewinds —
 * ticket numbers stay historically unique. Throws on missing task.
 */
export async function deleteTask(
  database: NanoboardDB,
  id: string,
): Promise<void> {
  await database.transaction(
    "rw",
    database.tasks,
    database.taskLabels,
    database.taskResources,
    async () => {
      await requireTask(database, id);
      await database.taskLabels.where("taskId").equals(id).delete();
      await database.taskResources.where("taskId").equals(id).delete();
      await database.tasks.delete(id);
    },
  );
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
  database: NanoboardDB,
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

  const now = Date.now();
  await database.transaction(
    "rw",
    database.tasks,
    database.columns,
    async () => {
      const columns = await database.columns
        .where("projectId")
        .equals(projectId)
        .toArray();
      const columnBySlug = new Map(
        columns.map((column) => [column.slug, column]),
      );
      for (const item of items) {
        if (item.status !== undefined && !columnBySlug.has(item.status)) {
          throw new Error(`Unknown column "${item.status}" in this project.`);
        }
      }

      const existing = await database.tasks.where("id").anyOf(ids).toArray();
      if (existing.length !== ids.length) {
        throw new Error("Tasks must belong to the requested project.");
      }
      for (const task of existing) {
        if (task.projectId !== projectId) {
          throw new Error("Tasks must belong to the requested project.");
        }
      }

      for (const item of items) {
        if (item.status === undefined) {
          await database.tasks.update(item.id, {
            position: item.position,
            updatedAt: now,
          });
        } else {
          const column = columnBySlug.get(item.status);
          if (!column) {
            throw new Error(`Unknown column "${item.status}" in this project.`);
          }
          await database.tasks.update(item.id, {
            position: item.position,
            status: item.status,
            columnId: column.id,
            updatedAt: now,
          });
        }
      }
    },
  );
}

/**
 * Same-column copy with optional validated rename. Copies
 * description/priority/startDate/dueDate; mints fresh id, number, position, and
 * timestamps. Throws on missing source.
 */
export async function duplicateTask(
  database: NanoboardDB,
  sourceId: string,
  title?: string,
): Promise<string> {
  const trimmed = title === undefined ? undefined : assertValidTitle(title);
  const now = Date.now();
  const id = createId();

  await database.transaction(
    "rw",
    database.tasks,
    database.projects,
    database.columns,
    async () => {
      const source = await database.tasks.get(sourceId);
      if (!source) {
        throw new Error("Task not found.");
      }
      const column = await database.columns.get(source.columnId);
      if (!column || column.projectId !== source.projectId) {
        throw new Error("Source column not found in this project.");
      }
      const project = await database.projects.get(source.projectId);
      if (!project) {
        throw new Error("Project not found.");
      }

      const position = await nextColumnPosition(
        database,
        source.projectId,
        source.columnId,
      );
      const number = project.lastTaskNumber + 1;

      await database.tasks.add({
        id,
        projectId: source.projectId,
        columnId: source.columnId,
        status: source.status,
        title: trimmed ?? source.title,
        description: source.description,
        position,
        number,
        priority: source.priority,
        startDate: source.startDate,
        dueDate: source.dueDate,
        createdAt: now,
        updatedAt: now,
      });
      await database.projects.update(source.projectId, {
        lastTaskNumber: number,
        updatedAt: now,
      });
    },
  );

  return id;
}
