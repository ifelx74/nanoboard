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
import { archiveTask } from "@/lib/db/queries";
import { db } from "@/lib/db/db";
import { toast } from "@/lib/toast";

export default function TaskArchiveDialog({
  open,
  onOpenChange,
  taskId,
  taskKeyText,
  taskTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskKeyText: string;
  taskTitle: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleArchive() {
    if (pending) return;
    setPending(true);
    try {
      await archiveTask(db, taskId);
      onOpenChange(false);
      toast.success("Task archived");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to archive task",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {taskKeyText}?</AlertDialogTitle>
          <AlertDialogDescription>
            “{taskTitle}” will be removed from the board and every work
            surface. You can restore it from the archive at any time.
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
