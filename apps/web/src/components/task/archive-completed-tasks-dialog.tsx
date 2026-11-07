import { useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { archiveCompletedTasks } from "@/lib/db/queries";
import { archiveCompletedTasksInColumn } from "@/lib/db/queries";
import { db } from "@/lib/db/db";
import { toast } from "@/lib/toast";

export default function ArchiveCompletedTasksDialog({
  open,
  onOpenChange,
  projectId,
  eligibleCount,
  columnName,
  columnId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  eligibleCount: number;
  columnName?: string;
  columnId?: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleArchive() {
    if (pending) return;
    setPending(true);
    try {
      const count = columnId
        ? await archiveCompletedTasksInColumn(db, projectId, columnId)
        : await archiveCompletedTasks(db, projectId);
      onOpenChange(false);
      if (count === 0) {
        toast.info("No completed tasks to archive");
      } else {
        toast.success(
          `Archived ${count} task${count === 1 ? "" : "s"}`,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to archive completed tasks",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Archive {eligibleCount} completed task
            {eligibleCount === 1 ? "" : "s"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {eligibleCount === 1 ? "This task" : "These tasks"} from
            {columnName ? ` ${columnName}` : " completed columns"} will be
            removed from the board and every work surface. You can restore
            {eligibleCount === 1 ? " it" : " them"} from the archive at any
            time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button variant="outline" size="sm" disabled={pending} />}
          >
            Cancel
          </AlertDialogClose>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => void handleArchive()}
          >
            {pending ? "Archiving" : "Archive"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
