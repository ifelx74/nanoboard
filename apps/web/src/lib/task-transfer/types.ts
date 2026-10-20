import type {
  ColumnSlug,
  DueDateString,
  StartDateString,
  TaskPriority,
} from "@/lib/db/schema";

export interface TaskTransferLabel {
  name: string;
  color: string;
}

export interface TaskTransferTask {
  title: string;
  description: string;
  status: string;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  userId: string | null;
  labels: TaskTransferLabel[];
}

export interface TaskTransferProject {
  name: string;
  slug: string;
  description: string | null;
  exportedAt: string;
}

export interface TaskTransferDocument {
  project: TaskTransferProject;
  tasks: TaskTransferTask[];
}

export interface ImportColumn {
  id: string;
  slug: ColumnSlug;
  name: string;
  position: number;
}

export interface ImportLabel {
  id: string;
  name: string;
  color: string;
}

export interface PlannedImportLabel {
  name: string;
  color: string;
  existing: boolean;
}

export interface PlannedImportTask {
  index: number;
  title: string;
  description: string;
  columnId: string;
  status: ColumnSlug;
  priority: TaskPriority;
  startDate?: StartDateString;
  dueDate?: DueDateString;
  labels: PlannedImportLabel[];
  warnings: string[];
}

export interface ImportFailure {
  index: number;
  title: string;
  error: string;
}

export interface ImportPlan {
  tasks: PlannedImportTask[];
  failures: ImportFailure[];
  warnings: number;
  labelsToCreate: string[];
}

export interface ImportTaskOutcome {
  index: number;
  title: string;
  success: boolean;
  warnings: string[];
  error?: string;
}

export interface ImportReport {
  imported: number;
  warned: number;
  failed: number;
  outcomes: ImportTaskOutcome[];
}
