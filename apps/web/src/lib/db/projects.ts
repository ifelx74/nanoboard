import { createId } from "@paralleldrive/cuid2";
import { db } from "./db";
import { forgetWhiteboard } from "./whiteboards";
import { isProjectIconKey } from "../project-icons";
import type { ProjectIconKey } from "../project-icons";
import type { ProjectKey } from "../task-key";
import type { DueDateString, Project } from "./schema";
import { DEFAULT_COLUMNS, DEFAULT_PROJECT_ICON } from "./schema";

export function getProject(projectId: string): Promise<Project | undefined> {
  return db.projects.get(projectId);
}

export function getProjects(): Promise<Project[]> {
  return db.projects.orderBy("position").toArray();
}

export const PROJECT_NAME_MIN = 1;
export const PROJECT_NAME_MAX = 100;
export const PROJECT_SLUG_MAX = 5;

const PROJECT_SLUG_FALLBACK = "PROJ";

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
async function takenSlugs(exceptId?: string): Promise<Set<string>> {
  const projects = await db.projects.toArray();
  return new Set(
    projects
      .filter((project) => project.id !== exceptId)
      .map((project) => project.slug.toLowerCase()),
  );
}

async function assertUniqueProjectSlug(
  slug: string,
  exceptId?: string,
): Promise<void> {
  if ((await takenSlugs(exceptId)).has(slug.toLowerCase())) {
    throw new Error(`A project with key "${slug}" already exists.`);
  }
}

export function suggestProjectKey(name: string): ProjectKey {
  const words = name
    .normalize("NFKC")
    .toUpperCase()
    .split(/[\s_-]+/)
    .map((word) => word.replace(/[^A-Z0-9]/g, ""))
    .filter((word) => word.length > 0);
  if (words.length === 0) return PROJECT_SLUG_FALLBACK as ProjectKey;
  const first = words[0] as string;
  const candidate =
    words.length === 1
      ? first.slice(0, PROJECT_SLUG_MAX)
      : words
          .slice(0, PROJECT_SLUG_MAX)
          .map((word) => word[0] as string)
          .join("");
  // Keys start with a letter; digit-led suggestions fall back.
  const key = candidate.replace(/^[0-9]+/, "");
  return (key || PROJECT_SLUG_FALLBACK) as ProjectKey;
}

async function resolveUniqueSlug(
  base: string,
  exceptId?: string,
): Promise<ProjectKey> {
  const taken = await takenSlugs(exceptId);
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

  await db.transaction("rw", [db.projects, db.columns], async () => {
    if (!suggested) {
      await assertUniqueProjectSlug(requested);
    }
    const slug = suggested ? await resolveUniqueSlug(requested) : requested;
    const ordered = await db.projects.orderBy("position").toArray();
    const position =
      ordered.length === 0
        ? 0
        : (ordered[ordered.length - 1]?.position ?? -1) + 1;

    await db.projects.add({
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
      await db.columns.add({
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
  });

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
  id: string,
  patch: UpdateProjectInput,
): Promise<void> {
  const existing = await db.projects.get(id);
  if (!existing) {
    throw new Error("Project not found.");
  }
  const next: Partial<Project> = { updatedAt: Date.now() };
  if (patch.name !== undefined) next.name = assertValidProjectName(patch.name);
  if (patch.slug !== undefined) {
    const slug = assertValidProjectSlug(patch.slug);
    await assertUniqueProjectSlug(slug, id);
    next.slug = slug;
  }
  if (patch.icon !== undefined) {
    assertValidProjectIcon(patch.icon);
    next.icon = patch.icon;
  }
  if (patch.description !== undefined) {
    next.description = patch.description?.trim() || undefined;
  }
  await db.projects.update(id, next);
}

export async function deleteProject(id: string): Promise<void> {
  const existing = await db.projects.get(id);
  if (!existing) {
    throw new Error("Project not found.");
  }
  const taskIds = (await db.tasks.where("projectId").equals(id).toArray()).map(
    (task) => task.id,
  );
  await db.transaction(
    "rw",
    [db.projects, db.columns, db.tasks, db.labels, db.taskLabels, db.whiteboards],
    async () => {
      // One indexed join wipe instead of a per-task loop (perf).
      await db.taskLabels.where("taskId").anyOf(taskIds).delete();
      await db.tasks.where("projectId").equals(id).delete();
      // Joins can't dangle: every project-label join belonged to a project
      // task (same-project attach rule), all removed above.
      await db.labels.where("projectId").equals(id).delete();
      await db.columns.where("projectId").equals(id).delete();
      // The scene row is unique per project (`&[projectId]`), so this deletes
      // at most one row; a project that never drew stores nothing. Also drop
      // its cached row identity so a later save can't resurrect the row.
      await db.whiteboards.where("projectId").equals(id).delete();
      forgetWhiteboard(id);
      await db.projects.delete(id);
    },
  );
}

/**
 * Dense position renumber from the full id list in its new order (the
 * sidebar drop handler calls exactly this). Unique ids covering every
 * project enforced; only changed rows rewrite.
 */
export async function reorderProjects(ids: string[]): Promise<void> {
  if (new Set(ids).size !== ids.length) {
    throw new Error("Project IDs must be unique.");
  }
  const all = await db.projects.toArray();
  const allIds = new Set(all.map((project) => project.id));
  if (ids.length !== all.length || !ids.every((id) => allIds.has(id))) {
    throw new Error("Reorder list must cover every project exactly once.");
  }
  const positionById = new Map(
    all.map((project) => [project.id, project.position]),
  );
  const now = Date.now();
  await db.transaction("rw", db.projects, async () => {
    for (let index = 0; index < ids.length; index += 1) {
      const projectId = ids[index];
      if (projectId === undefined) continue;
      if (positionById.get(projectId) !== index) {
        await db.projects.update(projectId, {
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
  projectId: string,
): Promise<ProjectStats> {
  return (
    (await getProjectsStats()).get(projectId) ?? {
      totalTasks: 0,
      doneTasks: 0,
      completionPercentage: 0,
      dueDate: null,
    }
  );
}

/**
 * Every project's stats in one pass (the sidebar subscribes to this once
 * instead of two queries per row).
 */
export async function getProjectsStats(): Promise<Map<string, ProjectStats>> {
  const [columns, tasks] = await Promise.all([
    db.columns.toArray(),
    db.tasks.toArray(),
  ]);
  const finalIds = new Set(
    columns.filter((column) => column.isFinal).map((column) => column.id),
  );
  const byProject = new Map<
    string,
    { total: number; done: number; dues: DueDateString[] }
  >();
  for (const task of tasks) {
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
