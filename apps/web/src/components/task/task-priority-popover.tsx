import { useTranslation } from "react-i18next";
import { updateTaskPriority } from "@/lib/db/queries";
import { TASK_PRIORITIES, type Task, type TaskPriority } from "@/lib/db/schema";
import { i18n } from "@/lib/i18n";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import TaskOptionPopover from "./task-option-popover";

export default function TaskPriorityPopover({
  task,
  disabled = false,
  children,
}: {
  task: Task;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation("task");
  const priorityNames: Record<TaskPriority, string> = {
    "no-priority": t("priority.noPriority"),
    low: t("priority.low"),
    medium: t("priority.medium"),
    high: t("priority.high"),
    urgent: t("priority.urgent"),
  };

  async function handlePriorityChange(priority: string): Promise<boolean> {
    try {
      await updateTaskPriority(task.id, priority as TaskPriority);
      return true;
    } catch (error) {
      const fallback = i18n.t("task:priority.error");
      toast.error(error instanceof Error ? error.message : fallback);
      return false;
    }
  }

  if (disabled) return <>{children}</>;

  return (
    <TaskOptionPopover
      options={TASK_PRIORITIES.map((priority) => ({
        key: priority,
        label: (
          <>
            {getPriorityIcon(priority)}
            <span className="text-sm capitalize">
              {priorityNames[priority]}
            </span>
          </>
        ),
      }))}
      selectedKey={task.priority}
      onSelect={handlePriorityChange}
    >
      {children}
    </TaskOptionPopover>
  );
}
