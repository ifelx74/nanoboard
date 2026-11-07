import type { NanoboardDB } from "./db";
import type { Task } from "./schema";

/**
 * The task archive: a soft-archive (`archivedAt` stamp) for tasks sitting in
 * final columns, with restore, an archived-only listing, the eligibility
 * count, and the bulk "archive completed tasks" sweep.
 *
 * Like the backup module and deleteProject, these functions take the
 * database instance as a parameter instead of reaching for the singleton —
 * that is what keeps them isolated and testable on fake-indexeddb (see
 * test-db.ts); production callers pass the singleton.
 */

/**
 * The one shared archive predicate: `archivedAt` absent means active. Every
 * archive decision (read exclusion, listing, sweep) routes through this —
 * never scattered ad-hoc conditions.
 */
export function isTaskArchived(task: Task): boolean {
  return task.archivedAt !== undefined;
}

/**
 * Soft-archives a task: one transaction reads the row, verifies the parent
 * column is final (the write throws otherwise — eligibility is a data-layer
 * invariant, never UI-enforced alone), then stamps `archivedAt` +
 * `updatedAt`. `columnId`, `status`, `position`, `number`, labels, and
 * resources are untouched; restoring re-inserts in place. Throws on a
 * missing task or non-final parent column.
 */
export async function archiveTask(
  database: NanoboardDB,
  id: string,
): Promise<void> {
  const now = Date.now();
  await database.transaction(
    "rw",
    database.tasks,
    database.columns,
    async () => {
      const task = await database.tasks.get(id);
      if (!task) {
        throw new Error("Task not found.");
      }
      const column = await database.columns.get(task.columnId);
      if (!column || column.projectId !== task.projectId) {
        throw new Error("Parent column not found in this project.");
      }
      if (!column.isFinal) {
        throw new Error("Only tasks in a completed column can be archived.");
      }
      await database.tasks.put({ ...task, archivedAt: now, updatedAt: now });
    },
  );
}

/**
 * Clears the archive stamp, bumping `updatedAt`; the task reappears in
 * exactly the column, position, and ticket number it had (they were never
 * repacked). Restoring an already-active task is a no-op. Throws on a
 * missing task.
 */
export async function restoreTask(
  database: NanoboardDB,
  id: string,
): Promise<void> {
  const now = Date.now();
  await database.transaction("rw", database.tasks, async () => {
    const task = await database.tasks.get(id);
    if (!task) {
      throw new Error("Task not found.");
    }
    if (!isTaskArchived(task)) return;
    const restored: Task = { ...task, updatedAt: now };
    delete restored.archivedAt;
    await database.tasks.put(restored);
  });
}

/**
 * The Archives page listing: the project's archived tasks only, newest
 * archive first.
 */
export async function getArchivedProjectTasks(
  database: NanoboardDB,
  projectId: string,
): Promise<Task[]> {
  const tasks = await database.tasks
    .where("projectId")
    .equals(projectId)
    .toArray();
  return tasks
    .filter(isTaskArchived)
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
}

/**
 * The shared eligibility read behind both the sweep and the count: every
 * non-archived task sitting in a final column of the project.
 */
async function getArchivableTasks(
  database: NanoboardDB,
  projectId: string,
): Promise<Task[]> {
  const columns = await database.columns
    .where("projectId")
    .equals(projectId)
    .toArray();
  const finalIds = new Set(
    columns.filter((column) => column.isFinal).map((column) => column.id),
  );
  const tasks = await database.tasks
    .where("projectId")
    .equals(projectId)
    .toArray();
  return tasks.filter(
    (task) => !isTaskArchived(task) && finalIds.has(task.columnId),
  );
}

interface ColumnArchiveTarget {
  columnId: string;
  count: number;
}

export async function archiveCompletedTasksInColumn(
  database: NanoboardDB,
  projectId: string,
  columnId: string,
): Promise<number> {
  const now = Date.now();
  return database.transaction(
    "rw",
    database.tasks,
    database.columns,
    async () => {
      const column = await database.columns.get(columnId);
      if (!column || column.projectId !== projectId || !column.isFinal) {
        return 0;
      }
      const archivable = (await getArchivableTasks(database, projectId)).filter(
        (task) => task.columnId === columnId,
      );
      if (archivable.length > 0) {
        await database.tasks.bulkPut(
          archivable.map((task) => ({
            ...task,
            archivedAt: now,
            updatedAt: now,
          })),
        );
      }
      return archivable.length;
    },
  );
}

export async function countArchivableTasksByFinalColumn(
  database: NanoboardDB,
  projectId: string,
): Promise<ColumnArchiveTarget[]> {
  const archivable = await getArchivableTasks(database, projectId);
  const counts = new Map<string, number>();
  for (const task of archivable) {
    counts.set(task.columnId, (counts.get(task.columnId) ?? 0) + 1);
  }
  return [...counts.entries()].map(([columnId, count]) => ({
    columnId,
    count,
  }));
}

/**
 * How many tasks the "Archive completed tasks" sweep would file right
 * now — backs the sweep's confirm dialog and the archive empty-state CTA.
 */
export async function countArchivableTasks(
  database: NanoboardDB,
  projectId: string,
): Promise<number> {
  return (await getArchivableTasks(database, projectId)).length;
}

/**
 * The bulk sweep behind "Archive completed tasks": one transaction archives
 * every non-archived task sitting in a final column of the project and
 * returns how many it filed. Skips already-archived tasks; a zero-count
 * sweep is a clean no-op. No eligibility escape hatch — only final-column
 * tasks are ever eligible.
 */
export async function archiveCompletedTasks(
  database: NanoboardDB,
  projectId: string,
): Promise<number> {
  const now = Date.now();
  return database.transaction(
    "rw",
    database.tasks,
    database.columns,
    async () => {
      const archivable = await getArchivableTasks(database, projectId);
      if (archivable.length > 0) {
        await database.tasks.bulkPut(
          archivable.map((task) => ({
            ...task,
            archivedAt: now,
            updatedAt: now,
          })),
        );
      }
      return archivable.length;
    },
  );
}
