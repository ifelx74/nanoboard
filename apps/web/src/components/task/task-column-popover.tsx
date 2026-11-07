import { moveTaskToColumn } from "@/lib/db/queries";
import type { Column, Task } from "@/lib/db/schema";
import { i18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import TaskOptionPopover from "./task-option-popover";

export default function TaskColumnPopover({
  task,
  columns,
  disabled = false,
  children,
}: {
  task: Task;
  columns: Column[];
  disabled?: boolean;
  children: React.ReactNode;
}) {
  async function handleColumnChange(columnId: string): Promise<boolean> {
    if (columnId === task.columnId) {
      return true;
    }
    const column = columns.find((candidate) => candidate.id === columnId);
    if (!column) return false;
    try {
      await moveTaskToColumn(task.id, column.slug);
      return true;
    } catch (error) {
      const fallback = i18n.t("task:column.error");
      toast.error(error instanceof Error ? error.message : fallback);
      return false;
    }
  }

  if (disabled) return <>{children}</>;

  return (
    <TaskOptionPopover
      options={columns.map((column) => ({
        key: column.id,
        label: <span className="text-sm">{column.name}</span>,
      }))}
      selectedKey={task.columnId}
      onSelect={handleColumnChange}
    >
      {children}
    </TaskOptionPopover>
  );
}
