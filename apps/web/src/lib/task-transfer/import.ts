import {
  TASK_PRIORITIES,
  type DueDateString,
  type TaskPriority,
  startDate as brandStartDate,
} from "@/lib/db/schema";
import { LABEL_COLORS } from "@/lib/label-color";
import type {
  ImportColumn,
  ImportFailure,
  ImportLabel,
  ImportPlan,
  PlannedImportLabel,
  PlannedImportTask,
} from "./types";

const TITLE_MAX = 256;
const LABEL_NAME_MAX = 60;
const UNTITLED_TASK = "Untitled task";
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}(?:$|[Tt ])/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseTaskImportFile(content: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("File is not valid JSON.");
  }

  const tasks = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.tasks)
      ? parsed.tasks
      : null;

  if (!tasks) {
    throw new Error("File has no list of tasks.");
  }
  if (tasks.length === 0) {
    throw new Error("File has no tasks to import.");
  }
  return tasks;
}

function planTitle(value: unknown): { title: string; warnings: string[] } {
  if (value === undefined || value === null) {
    return {
      title: UNTITLED_TASK,
      warnings: [`Task has no title; used "${UNTITLED_TASK}".`],
    };
  }
  if (typeof value !== "string") {
    return {
      title: UNTITLED_TASK,
      warnings: [`Title is not text; used "${UNTITLED_TASK}".`],
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      title: UNTITLED_TASK,
      warnings: [`Task has no title; used "${UNTITLED_TASK}".`],
    };
  }
  if (trimmed.length > TITLE_MAX) {
    return {
      title: trimmed.slice(0, TITLE_MAX),
      warnings: [
        `Title was longer than ${TITLE_MAX} characters and was shortened.`,
      ],
    };
  }
  return { title: trimmed, warnings: [] };
}

function planDescription(value: unknown): {
  description: string;
  warnings: string[];
} {
  if (value === undefined || value === null) {
    return { description: "", warnings: [] };
  }
  if (typeof value !== "string") {
    return {
      description: "",
      warnings: ["Description is not text; ignored."],
    };
  }
  return { description: value, warnings: [] };
}

function planPriority(value: unknown): {
  priority: TaskPriority;
  warnings: string[];
} {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return { priority: "no-priority", warnings: [] };
  }
  if (typeof value !== "string") {
    return {
      priority: "no-priority",
      warnings: ["Priority is not text; used no-priority."],
    };
  }

  const trimmed = value.trim();
  if ((TASK_PRIORITIES as readonly string[]).includes(trimmed)) {
    return { priority: trimmed as TaskPriority, warnings: [] };
  }
  return {
    priority: "no-priority",
    warnings: [`Unknown priority "${trimmed}" mapped to no-priority.`],
  };
}

function isRealDay(day: string): boolean {
  const match = DAY_PATTERN.exec(day);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, date));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === date
  );
}

function planDay(
  value: unknown,
  label: "start date" | "due date",
): { value?: string; warnings: string[] } {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return { warnings: [] };
  }
  if (typeof value !== "string") {
    return { warnings: [`${capitalize(label)} is not text; ignored.`] };
  }

  const raw = value.trim();
  if (!ISO_DAY_PATTERN.test(raw)) {
    return {
      warnings: [`Invalid ${label} "${raw}" ignored.`],
    };
  }
  const day = raw.slice(0, 10);
  if (!isRealDay(day)) {
    return {
      warnings: [`Invalid ${label} "${raw}" ignored.`],
    };
  }
  return { value: day, warnings: [] };
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function resolveColumn(
  value: string,
  columns: ImportColumn[],
): { column: ImportColumn; matched: boolean } {
  const trimmed = value.trim();
  const exact = columns.find((column) => column.slug === trimmed);
  if (exact) return { column: exact, matched: true };

  const lower = trimmed.toLowerCase();
  const slugMatches = columns.filter(
    (column) => column.slug.toLowerCase() === lower,
  );
  if (slugMatches.length === 1) {
    return { column: slugMatches[0] as ImportColumn, matched: true };
  }

  const nameMatches = columns.filter(
    (column) => column.name.toLowerCase() === lower,
  );
  if (nameMatches.length === 1) {
    return { column: nameMatches[0] as ImportColumn, matched: true };
  }

  return { column: columns[0] as ImportColumn, matched: false };
}

function planLabelColor(
  value: unknown,
  name: string,
  warnings: string[],
): string {
  if (typeof value !== "string" || value.trim() === "") {
    warnings.push(`Label "${name}" has no color; used gray.`);
    return "gray";
  }

  const trimmed = value.trim();
  const palette = LABEL_COLORS.find((color) => color.value === trimmed);
  if (palette) return palette.value;

  warnings.push(
    `Label "${name}" has unsupported color "${trimmed}"; used gray.`,
  );
  return "gray";
}

function planLabels(
  value: unknown,
  existing: Map<string, ImportLabel>,
): { labels: PlannedImportLabel[]; warnings: string[] } {
  if (value === undefined || value === null) {
    return { labels: [], warnings: [] };
  }
  if (!Array.isArray(value)) {
    return {
      labels: [],
      warnings: ["Labels is not a list; ignored."],
    };
  }

  const labels = new Map<string, PlannedImportLabel>();
  const warnings: string[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      warnings.push("A label entry is not an object and was ignored.");
      continue;
    }
    if (typeof entry.name !== "string") {
      warnings.push("A label name is not text and was ignored.");
      continue;
    }

    let name = entry.name.trim();
    if (!name) {
      warnings.push("A blank label name was ignored.");
      continue;
    }
    if (name.length > LABEL_NAME_MAX) {
      name = name.slice(0, LABEL_NAME_MAX);
      warnings.push(
        `A label name was longer than ${LABEL_NAME_MAX} characters and was shortened.`,
      );
    }

    const key = name.toLowerCase();
    if (labels.has(key)) continue;

    const match = existing.get(key);
    if (match) {
      labels.set(key, {
        name: match.name,
        color: match.color,
        existing: true,
      });
      continue;
    }

    labels.set(key, {
      name,
      color: planLabelColor(entry.color, name, warnings),
      existing: false,
    });
  }

  return { labels: [...labels.values()], warnings };
}

export function planTaskImport(
  items: unknown[],
  columns: ImportColumn[],
  existingLabels: ImportLabel[],
): ImportPlan {
  const orderedColumns = [...columns].sort((a, b) => a.position - b.position);
  const firstColumn = orderedColumns[0];
  if (!firstColumn) {
    throw new Error("Project has no columns.");
  }

  const existing = new Map<string, ImportLabel>();
  for (const label of existingLabels) {
    const key = label.name.toLowerCase();
    if (!existing.has(key)) existing.set(key, label);
  }

  const tasks: PlannedImportTask[] = [];
  const failures: ImportFailure[] = [];
  const labelsToCreate = new Map<string, string>();

  items.forEach((item, index) => {
    if (!isRecord(item)) {
      failures.push({
        index,
        title: `Task ${index + 1}`,
        error: "Task is not an object.",
      });
      return;
    }

    const titlePlan = planTitle(item.title);
    const warnings = [...titlePlan.warnings];
    const title = titlePlan.title;

    let column = firstColumn;
    const rawStatus = item.status;
    if (
      rawStatus !== undefined &&
      rawStatus !== null &&
      !(typeof rawStatus === "string" && rawStatus.trim() === "")
    ) {
      if (typeof rawStatus !== "string") {
        failures.push({
          index,
          title,
          error: "Status is not text.",
        });
        return;
      }
      const resolved = resolveColumn(rawStatus, orderedColumns);
      column = resolved.column;
      if (!resolved.matched) {
        warnings.push(
          `Unknown status "${rawStatus.trim()}" mapped to "${column.name}".`,
        );
      }
    }

    const descriptionPlan = planDescription(item.description);
    warnings.push(...descriptionPlan.warnings);

    const priorityPlan = planPriority(item.priority);
    warnings.push(...priorityPlan.warnings);

    const startPlan = planDay(item.startDate, "start date");
    const duePlan = planDay(item.dueDate, "due date");
    warnings.push(...startPlan.warnings, ...duePlan.warnings);

    let start = startPlan.value;
    const due = duePlan.value;
    if (start !== undefined && due !== undefined && start > due) {
      warnings.push("Start date is after due date; start date ignored.");
      start = undefined;
    }

    const labelPlan = planLabels(item.labels, existing);
    warnings.push(...labelPlan.warnings);
    for (const label of labelPlan.labels) {
      if (!label.existing)
        labelsToCreate.set(label.name.toLowerCase(), label.name);
    }

    tasks.push({
      index,
      title,
      description: descriptionPlan.description,
      columnId: column.id,
      status: column.slug,
      priority: priorityPlan.priority,
      startDate: start ? brandStartDate(start) : undefined,
      dueDate: due as DueDateString | undefined,
      labels: labelPlan.labels,
      warnings,
    });
  });

  return {
    tasks,
    failures,
    warnings: tasks.filter((task) => task.warnings.length > 0).length,
    labelsToCreate: [...labelsToCreate.values()].sort(),
  };
}
