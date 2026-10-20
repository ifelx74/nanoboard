import type { Column, Label, Project, Task } from "@/lib/db/schema";
import { markdownToHtml } from "./description";
import type { TaskTransferDocument } from "./types";

function isoDay(value: string | undefined): string | null {
  return value ? `${value}T00:00:00.000Z` : null;
}

function compareLabels(a: Label, b: Label): number {
  if (a.name === b.name) return 0;
  return a.name < b.name ? -1 : 1;
}

export async function buildTaskTransferDocument(input: {
  project: Project;
  columns: Column[];
  tasks: Task[];
  labelsByTask: Map<string, Label[]>;
  exportedAt?: string;
}): Promise<TaskTransferDocument> {
  const columnPosition = new Map(
    input.columns.map((column) => [column.id, column.position]),
  );
  const ordered = [...input.tasks].sort((a, b) => {
    const left = columnPosition.get(a.columnId) ?? Number.MAX_SAFE_INTEGER;
    const right = columnPosition.get(b.columnId) ?? Number.MAX_SAFE_INTEGER;
    return left - right || a.position - b.position || a.number - b.number;
  });

  return {
    project: {
      name: input.project.name,
      slug: input.project.slug,
      description: input.project.description ?? null,
      exportedAt: input.exportedAt ?? new Date().toISOString(),
    },
    tasks: await Promise.all(
      ordered.map(async (task) => ({
        title: task.title,
        description: await markdownToHtml(task.description),
        status: task.status,
        priority: task.priority,
        startDate: isoDay(task.startDate),
        dueDate: isoDay(task.dueDate),
        userId: null,
        labels: (input.labelsByTask.get(task.id) ?? [])
          .slice()
          .sort(compareLabels)
          .map((label) => ({ name: label.name, color: label.color })),
      })),
    ),
  };
}
