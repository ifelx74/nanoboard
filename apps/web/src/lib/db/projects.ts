import { createId } from "@paralleldrive/cuid2";
import type { NanoboardDB } from "./db";
import { isTaskArchived } from "./archive";
import { forgetWhiteboard } from "./whiteboards";
import { deleteWhiteboardPreview } from "./whiteboard-previews";
import { isProjectIconKey } from "../project-icons";
import type { ProjectIconKey } from "../project-icons";
import {
  clearProjectStorage,
  type StorageLike,
} from "../storage/project-storage";
import type { ProjectKey } from "../task-key";
import { PROJECT_SLUG_MAX, suggestProjectKey } from "../task-key";
import type { DueDateString, Project } from "./schema";
import { DEFAULT_COLUMNS, DEFAULT_PROJECT_ICON } from "./schema";

export function getProject(
  database: NanoboardDB,
  projectId: string,
): Promise<Project | undefined> {
  return database.projects.get(projectId);
}

export function getProjects(database: NanoboardDB): Promise<Project[]> {
  return database.projects.orderBy("position").toArray();
}

export const PROJECT_NAME_MIN = 1;
export const PROJECT_NAME_MAX = 100;

/** Hard cap so a saturated namespace fails loudly instead of hanging. */
const MAX_SLUG_ATTEMPTS = 10_000;

const PROJECT_SLUG_PATTERN = /^[A-Z][A-Z0-9]*$/;

function assertValidProjectName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < PROJECT_NAME_MIN || trimmed.length > PROJECT_NAME_MAX) {
    throw new Error(
      `Project name must be ${PROJECT_NAME_MIN}–${PROJECT_NAME_MAX} characters after trimming.`,
    );
  }
  return trimmed;
}

function assertValidProjectSlug(slug: string): ProjectKey {
  const trimmed = slug.trim().toUpperCase();
  if (trimmed.length === 0 || trimmed.length > PROJECT_SLUG_MAX) {
    throw new Error(
      `Project key must be 1–${PROJECT_SLUG_MAX} characters after trimming.`,
    );
  }
  if (!PROJECT_SLUG_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid project key "${slug}". Use letters and numbers, starting with a letter.`,
    );
  }
  return trimmed as ProjectKey;
}

function assertValidProjectIcon(icon: string): asserts icon is ProjectIconKey {
  if (!isProjectIconKey(icon)) {
    throw new Error(`Invalid project icon "${icon}".`);
  }
}

/** Single-scan slug census shared by the uniqueness checks below (perf). */
async function takenSlugs(
  database: NanoboardDB,
  exceptId?: string,
): Promise<Set<string>> {
  const projects = await database.projects.toArray();
  return new Set(
    projects
      .filter((project) => project.id !== exceptId)
      .map((project) => project.slug.toLowerCase()),
  );
}

async function assertUniqueProjectSlug(
  database: NanoboardDB,
  slug: string,
  exceptId?: string,
): Promise<void> {
  if ((await takenSlugs(database, exceptId)).has(slug.toLowerCase())) {
    throw new Error(`A project with key "${slug}" already exists.`);
  }
}

async function resolveUniqueSlug(
  database: NanoboardDB,
  base: string,
  exceptId?: string,
): Promise<ProjectKey> {
  const taken = await takenSlugs(database, exceptId);
  if (!taken.has(base.toLowerCase())) return base as ProjectKey;
  // Digit suffix, no dash (keys stay bare alphanumerics); the stem yields
  // room so the stored key never exceeds the max the validator enforces.
  for (let suffix = 2; suffix < MAX_SLUG_ATTEMPTS; suffix += 1) {
    const tail = String(suffix);
    const stem = base.slice(0, PROJECT_SLUG_MAX - tail.length);
    const candidate = `${stem}${tail}`;
    if (!taken.has(candidate.toLowerCase())) return candidate as ProjectKey;
  }
  throw new Error("Could not allocate a unique project key.");
}

export interface CreateProjectInput {
  name: string;
  slug?: string;
  icon?: string;
}

export async function createProject(
  database: NanoboardDB,
  input: CreateProjectInput,
): Promise<string> {
  const name = assertValidProjectName(input.name);
  const icon = input.icon ?? DEFAULT_PROJECT_ICON;
  assertValidProjectIcon(icon);
  const now = Date.now();
  const id = createId();

  const suggested = input.slug === undefined;

  const requested =
    input.slug === undefined
      ? suggestProjectKey(name)
      : assertValidProjectSlug(input.slug);

  await database.transaction(
    "rw",
    [database.projects, database.columns],
    async () => {
      if (!suggested) {
        await assertUniqueProjectSlug(database, requested);
      }
      const slug = suggested
        ? await resolveUniqueSlug(database, requested)
        : requested;
      const ordered = await database.projects.orderBy("position").toArray();
      const position =
        ordered.length === 0
          ? 0
          : (ordered[ordered.length - 1]?.position ?? -1) + 1;

      await database.projects.add({
        id,
        name,
        slug,
        icon,
        position,
        lastTaskNumber: 0,
        createdAt: now,
        updatedAt: now,
      });
      for (const column of DEFAULT_COLUMNS) {
        await database.columns.add({
          id: createId(),
          projectId: id,
          name: column.name,
          slug: column.slug,
          position: column.position,
          isFinal: column.isFinal,
          createdAt: now,
          updatedAt: now,
        });
      }
    },
  );

  return id;
}

export interface UpdateProjectInput {
  name?: string;
  slug?: string;
  icon?: string;
  description?: string | null;
}

/** Field patch; slug conflicts exclude the project itself. */
export async function updateProject(
  database: NanoboardDB,
  id: string,
  patch: UpdateProjectInput,
): Promise<void> {
  const existing = await database.projects.get(id);
  if (!existing) {
    throw new Error("Project not found.");
  }
  const next: Partial<Project> = { updatedAt: Date.now() };
  if (patch.name !== undefined) next.name = assertValidProjectName(patch.name);
  if (patch.slug !== undefined) {
    const slug = assertValidProjectSlug(patch.slug);
    await assertUniqueProjectSlug(database, slug, id);
    next.slug = slug;
  }
  if (patch.icon !== undefined) {
    assertValidProjectIcon(patch.icon);
    next.icon = patch.icon;
  }
  if (patch.description !== undefined) {
    next.description = patch.description?.trim() || undefined;
  }
  await database.projects.update(id, next);
}

export interface DeleteProjectOptions {
  /** Override `localStorage` for per-project UI state cleanup (tests pass a memory stub or `null`). */
  storage?: StorageLike | null;
}

/**
 * Deletes the project and every row hanging off it in one transaction, then
 * drops its cached whiteboard identity and per-project `localStorage` state.
 */
export async function deleteProject(
  database: NanoboardDB,
  id: string,
  options?: DeleteProjectOptions,
): Promise<void> {
  await database.transaction(
    "rw",
    [
      database.projects,
      database.columns,
      database.tasks,
      database.labels,
      database.taskLabels,
      database.taskResources,
      database.whiteboards,
      database.whiteboardPreviews,
      database.pages,
      database.pageContents,
      database.pageAssets,
    ],
    async () => {
      const existing = await database.projects.get(id);
      if (!existing) {
        throw new Error("Project not found.");
      }
      const taskIds = (
        await database.tasks.where("projectId").equals(id).toArray()
      ).map((task) => task.id);
      // One indexed join & resource wipe instead of per-task loops (perf).
      if (taskIds.length > 0) {
        await database.taskLabels.where("taskId").anyOf(taskIds).delete();
        await database.taskResources.where("taskId").anyOf(taskIds).delete();
      }
      await database.tasks.where("projectId").equals(id).delete();
      // Joins can't dangle: every project-label join belonged to a project
      // task (same-project attach rule), all removed above.
      await database.labels.where("projectId").equals(id).delete();
      await database.columns.where("projectId").equals(id).delete();
      // The scene row is unique per project (`&[projectId]`), so this deletes
      // at most one row; a project that never drew stores nothing.
      await database.whiteboards.where("projectId").equals(id).delete();
      // The preview row rides the scene row's lifecycle: evicted in the same
      // transaction so the gallery's "has content" index never outlives the
      // project (a no-op for projects that never drew).
      await deleteWhiteboardPreview(database, id);
      // Pages and their document payloads + binary image assets cascade
      // atomically with the project so no orphaned rows survive.
      await database.pageAssets.where("projectId").equals(id).delete();
      await database.pageContents.where("projectId").equals(id).delete();
      await database.pages.where("projectId").equals(id).delete();
      await database.projects.delete(id);
    },
  );
  // Drop cached row identity and ephemeral per-project browser state only
  // after the deletion transaction commits cleanly.
  forgetWhiteboard(database, id);
  clearProjectStorage(id, options?.storage);
}

/**
 * Dense position renumber from the full id list in its new order (the
 * sidebar drop handler calls exactly this). Unique ids covering every
 * project enforced; only changed rows rewrite.
 */
export async function reorderProjects(
  database: NanoboardDB,
  ids: string[],
): Promise<void> {
  if (new Set(ids).size !== ids.length) {
    throw new Error("Project IDs must be unique.");
  }
  const all = await database.projects.toArray();
  const allIds = new Set(all.map((project) => project.id));
  if (ids.length !== all.length || !ids.every((id) => allIds.has(id))) {
    throw new Error("Reorder list must cover every project exactly once.");
  }
  const positionById = new Map(
    all.map((project) => [project.id, project.position]),
  );
  const now = Date.now();
  await database.transaction("rw", database.projects, async () => {
    for (let index = 0; index < ids.length; index += 1) {
      const projectId = ids[index];
      if (projectId === undefined) continue;
      if (positionById.get(projectId) !== index) {
        await database.projects.update(projectId, {
          position: index,
          updatedAt: now,
        });
      }
    }
  });
}

export interface ProjectStats {
  totalTasks: number;
  doneTasks: number;
  /** Rounded 0–100; 0 when the project has no tasks. */
  completionPercentage: number;
  /** Soonest due date in the project, or null when none is set. */
  dueDate: DueDateString | null;
}

/** Computed read backing the sidebar progress donut; no stored aggregates. */
export async function getProjectStats(
  database: NanoboardDB,
  projectId: string,
): Promise<ProjectStats> {
  return (
    (await getProjectsStats(database)).get(projectId) ?? {
      totalTasks: 0,
      doneTasks: 0,
      completionPercentage: 0,
      dueDate: null,
    }
  );
}

/**
 * Every project's stats in one pass (the sidebar subscribes to this once
 * instead of two queries per row). Archived tasks are excluded via the
 * shared archive predicate — stats describe live work only.
 */
export async function getProjectsStats(
  database: NanoboardDB,
): Promise<Map<string, ProjectStats>> {
  const [columns, tasks] = await Promise.all([
    database.columns.toArray(),
    database.tasks.toArray(),
  ]);
  const liveTasks = tasks.filter((task) => !isTaskArchived(task));
  const finalIds = new Set(
    columns.filter((column) => column.isFinal).map((column) => column.id),
  );
  const byProject = new Map<
    string,
    { total: number; done: number; dues: DueDateString[] }
  >();
  for (const task of liveTasks) {
    let entry = byProject.get(task.projectId);
    if (!entry) {
      entry = { total: 0, done: 0, dues: [] };
      byProject.set(task.projectId, entry);
    }
    entry.total += 1;
    if (finalIds.has(task.columnId)) entry.done += 1;
    if (task.dueDate !== undefined) entry.dues.push(task.dueDate);
  }
  const stats = new Map<string, ProjectStats>();
  for (const [projectId, entry] of byProject) {
    entry.dues.sort();
    stats.set(projectId, {
      totalTasks: entry.total,
      doneTasks: entry.done,
      completionPercentage:
        entry.total === 0 ? 0 : Math.round((entry.done / entry.total) * 100),
      dueDate: entry.dues[0] ?? null,
    });
  }
  return stats;
}
