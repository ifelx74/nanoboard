import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, CircleDot, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
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

function countBy<T>(items: Iterable<T>, key: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

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

  const makeSubjectDef = (
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

  const statusCounts = useMemo(
    () => countBy(tasks, (task) => task.columnId),
    [tasks],
  );
  const priorityCounts = useMemo(
    () => countBy(tasks, (task) => task.priority),
    [tasks],
  );
  const labelCounts = useMemo(() => {
    const assigned: Label[] = [];
    for (const labels of labelsByTask.values()) assigned.push(...labels);
    return countBy(assigned, (label) => label.id);
  }, [labelsByTask]);

  const dueCounts = useMemo(() => {
    const dueContext = { query: "", today: new Date(), weekStartsOn };
    const counts = new Map<string, number>();
    for (const option of DUE_DATE_OPTIONS) {
      const optionFilters = {
        ...EMPTY_BOARD_FILTERS,
        dueDate: [option.value],
      };
      let count = 0;
      for (const task of tasks) {
        if (
          taskMatchesBoardFilters(
            task,
            labelsByTask.get(task.id)?.map((label) => label.id),
            optionFilters,
            dueContext,
          )
        ) {
          count += 1;
        }
      }
      counts.set(option.value, count);
    }
    return counts;
  }, [tasks, labelsByTask, weekStartsOn]);

  return [
    makeSubjectDef("status", {
      label: "Status",
      icon: <CircleDot />,
      options: columns.map((column) => ({
        value: column.id,
        label: column.name,
        count: statusCounts.get(column.id) ?? 0,
        icon: getColumnIcon(column.slug, column.isFinal),
      })),
    }),
    makeSubjectDef("priority", {
      label: "Priority",
      icon: getPriorityIcon("high"),
      options: PRIORITY_ORDER.map((priority) => ({
        value: priority,
        label: priorityLabel(priority as Task["priority"]),
        count: priorityCounts.get(priority) ?? 0,
        icon: getPriorityIcon(priority),
      })),
    }),
    makeSubjectDef("labels", {
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
    makeSubjectDef("dueDate", {
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
