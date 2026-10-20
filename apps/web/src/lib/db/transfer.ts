import { createId } from "@paralleldrive/cuid2";
import Dexie from "dexie";
import { toStoredDescription } from "@/lib/task-transfer/description";
import type {
  ImportTaskOutcome,
  PlannedImportTask,
} from "@/lib/task-transfer/types";
import { LABEL_COLORS } from "../label-color";
import { db } from "./db";
import { getProjectTaskLabels } from "./labels";
import { getProject } from "./projects";
import type { Column, Label, Project, Task } from "./schema";
import { TASK_PRIORITIES } from "./schema";
import { getProjectColumns, getProjectTasks } from "./tasks";

export interface ProjectTransferSource {
  project: Project;
  columns: Column[];
  tasks: Task[];
  labelsByTask: Map<string, Label[]>;
}

export async function readProjectTransferSource(
  projectId: string,
): Promise<ProjectTransferSource> {
  const [project, columns, tasks, labelsByTask] = await Promise.all([
    getProject(projectId),
    getProjectColumns(projectId),
    getProjectTasks(projectId),
    getProjectTaskLabels(projectId),
  ]);
  if (!project) {
    throw new Error("Project not found.");
  }
  return { project, columns, tasks, labelsByTask };
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

function assertValidTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length < 1 || trimmed.length > 256) {
    throw new Error("Title must be 1–256 characters after trimming.");
  }
  return trimmed;
}

function assertValidDateRange(
  start: string | undefined,
  due: string | undefined,
): void {
  if (start !== undefined && due !== undefined && start > due) {
    throw new Error("Start date cannot be after due date.");
  }
}

async function importPlannedTask(
  projectId: string,
  task: PlannedImportTask,
): Promise<void> {
  const title = assertValidTitle(task.title);
  if (!TASK_PRIORITIES.includes(task.priority)) {
    throw new Error(`Invalid priority "${task.priority}".`);
  }
  assertValidDateRange(task.startDate, task.dueDate);
  const description = await toStoredDescription(task.description);

  await db.transaction(
    "rw",
    db.tasks,
    db.projects,
    db.columns,
    db.taskLabels,
    db.labels,
    async () => {
      const column = await db.columns.get(task.columnId);
      if (!column || column.projectId !== projectId) {
        throw new Error("Destination column not found in this project.");
      }
      const project = await db.projects.get(projectId);
      if (!project) {
        throw new Error("Project not found.");
      }

      const siblings = await db.labels
        .where("projectId")
        .equals(projectId)
        .toArray();
      const byName = new Map(
        siblings.map((label) => [label.name.toLowerCase(), label]),
      );
      const labelIds: string[] = [];

      for (const planned of task.labels) {
        const key = planned.name.toLowerCase();
        const existing = byName.get(key);
        if (existing) {
          labelIds.push(existing.id);
          continue;
        }

        const color = LABEL_COLORS.some(
          (candidate) => candidate.value === planned.color,
        )
          ? planned.color
          : "gray";
        const id = createId();
        const now = Date.now();
        const label: Label = {
          id,
          projectId,
          name: planned.name,
          color,
          createdAt: now,
          updatedAt: now,
        };
        await db.labels.add(label);
        byName.set(key, label);
        labelIds.push(id);
      }

      const position = await nextColumnPosition(projectId, task.columnId);
      const number = project.lastTaskNumber + 1;
      const id = createId();
      const now = Date.now();

      await db.tasks.add({
        id,
        projectId,
        columnId: task.columnId,
        status: column.slug,
        title,
        description,
        position,
        number,
        priority: task.priority,
        startDate: task.startDate,
        dueDate: task.dueDate,
        createdAt: now,
        updatedAt: now,
      });
      await db.projects.update(projectId, {
        lastTaskNumber: number,
        updatedAt: now,
      });
      for (const labelId of new Set(labelIds)) {
        await db.taskLabels.put({ taskId: id, labelId });
      }
    },
  );
}

export async function importProjectTasks(
  projectId: string,
  tasks: PlannedImportTask[],
): Promise<ImportTaskOutcome[]> {
  const outcomes: ImportTaskOutcome[] = [];
  for (const task of tasks) {
    try {
      await importPlannedTask(projectId, task);
      outcomes.push({
        index: task.index,
        title: task.title,
        success: true,
        warnings: task.warnings,
      });
    } catch (error) {
      outcomes.push({
        index: task.index,
        title: task.title,
        success: false,
        warnings: task.warnings,
        error: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }
  return outcomes;
}
