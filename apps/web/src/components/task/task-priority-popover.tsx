import { updateTaskPriority } from "@/lib/db/queries";
import { TASK_PRIORITIES, type Task, type TaskPriority } from "@/lib/db/schema";
import {
  getPriorityIcon,
  priorityLabel,
} from "@/lib/priority";
import { toast } from "@/lib/toast";
import TaskOptionPopover from "./task-option-popover";

export default function TaskPriorityPopover({
  task,
  children,
}: {
  task: Task;
  children: React.ReactNode;
}) {
  async function handlePriorityChange(priority: string): Promise<boolean> {
    try {
      await updateTaskPriority(task.id, priority as TaskPriority);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update priority",
      );
      return false;
    }
  }

  return (
    <TaskOptionPopover
      options={TASK_PRIORITIES.map((priority) => ({
        key: priority,
        label: (
          <>
            {getPriorityIcon(priority)}
            <span className="text-sm capitalize">
              {priorityLabel(priority)}
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
