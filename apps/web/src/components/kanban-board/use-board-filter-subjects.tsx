import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, CircleDot, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { useWeekStartsOn } from "@/components/calendar/use-week-starts-on";
import { getColumnIcon } from "@/lib/column";
import { getProjectLabels } from "@/lib/db/queries";
import type { Column, Label, Task } from "@/lib/db/schema";
import { resolveLabelColor } from "@/lib/label-color";
import { getPriorityIcon, priorityLabel } from "@/lib/priority";
import {
  DUE_DATE_FILTER_VALUES,
  EMPTY_BOARD_FILTERS,
  taskMatchesBoardFilters,
  type BoardFilterSubject,
} from "./board-filter-model";
import type { BoardTaskView } from "./use-board-task-view";

export interface BoardFilterOption {
  value: string;
  label: string;
  count: number;
  icon?: ReactNode;
}

export interface BoardFilterSubjectDef {
  id: BoardFilterSubject;
  label: string;
  icon: ReactNode;
  options: BoardFilterOption[];
  selected: string[];
  negated: boolean;
  onToggle: (value: string) => void;
  onNegate: (negated: boolean) => void;
  onClear: () => void;
}

const PRIORITY_ORDER = ["urgent", "high", "medium", "low", "no-priority"];

const DUE_DATE_OPTIONS = [
  { value: DUE_DATE_FILTER_VALUES.dueThisWeek, label: "Due this week" },
  { value: DUE_DATE_FILTER_VALUES.dueNextWeek, label: "Due next week" },
  { value: DUE_DATE_FILTER_VALUES.noDueDate, label: "No due date" },
] as const;

/**
 * Filter-menu subjects for the board: status, priority, labels, due date.
 * Counts come from the unfiltered task set; members and custom fields do
 * not exist client-side and are never offered.
 */
export function useBoardFilterSubjects(
  view: BoardTaskView,
  {
    columns,
    tasks,
    labelsByTask,
    projectId,
  }: {
    columns: Column[];
    tasks: Task[];
    labelsByTask: Map<string, Label[]>;
    projectId: string;
  },
): BoardFilterSubjectDef[] {
  const [weekStartsOn] = useWeekStartsOn();
  const palette = useLiveQuery(() => getProjectLabels(projectId), [projectId]);
  const { filters, toggleFilter, setNegated, clearSubject } = view;

  const subject = (
    id: BoardFilterSubject,
    fields: Pick<BoardFilterSubjectDef, "label" | "icon" | "options">,
  ): BoardFilterSubjectDef => ({
    id,
    selected: filters[id] ?? [],
    negated: (filters.negated ?? []).includes(id),
    onToggle: (value: string) => toggleFilter(id, value),
    onNegate: (negated: boolean) => setNegated(id, negated),
    onClear: () => clearSubject(id),
    ...fields,
  });

  const statusCounts = new Map<string, number>();
  const priorityCounts = new Map<string, number>();
  for (const task of tasks) {
    statusCounts.set(task.columnId, (statusCounts.get(task.columnId) ?? 0) + 1);
    priorityCounts.set(task.priority, (priorityCounts.get(task.priority) ?? 0) + 1);
  }
  const labelCounts = new Map<string, number>();
  for (const labels of labelsByTask.values()) {
    for (const label of labels) {
      labelCounts.set(label.id, (labelCounts.get(label.id) ?? 0) + 1);
    }
  }

  const dueContext = { query: "", today: new Date(), weekStartsOn };
  const dueCounts = new Map<string, number>();
  for (const option of DUE_DATE_OPTIONS) {
    let count = 0;
    for (const task of tasks) {
      if (
        taskMatchesBoardFilters(
          task,
          labelsByTask.get(task.id)?.map((label) => label.id),
          { ...EMPTY_BOARD_FILTERS, dueDate: [option.value] },
          dueContext,
        )
      ) {
        count += 1;
      }
    }
    dueCounts.set(option.value, count);
  }

  return [
    subject("status", {
      label: "Status",
      icon: <CircleDot />,
      options: columns.map((column) => ({
        value: column.id,
        label: column.name,
        count: statusCounts.get(column.id) ?? 0,
        icon: getColumnIcon(column.slug, column.isFinal),
      })),
    }),
    subject("priority", {
      label: "Priority",
      icon: getPriorityIcon("high"),
      options: PRIORITY_ORDER.map((priority) => ({
        value: priority,
        label: priorityLabel(priority as Task["priority"]),
        count: priorityCounts.get(priority) ?? 0,
        icon: getPriorityIcon(priority),
      })),
    }),
    subject("labels", {
      label: "Labels",
      icon: <Tag />,
      options: (palette ?? []).map((label) => ({
        value: label.id,
        label: label.name,
        count: labelCounts.get(label.id) ?? 0,
        icon: (
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: resolveLabelColor(label.color) }}
          />
        ),
      })),
    }),
    subject("dueDate", {
      label: "Due date",
      icon: <CalendarDays />,
      options: DUE_DATE_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        count: dueCounts.get(option.value) ?? 0,
      })),
    }),
  ];
}
