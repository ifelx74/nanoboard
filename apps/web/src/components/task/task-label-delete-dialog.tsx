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
import { deleteLabel } from "@/lib/db/queries";
import type { Label } from "@/lib/db/schema";
import { toast } from "@/lib/toast";

export default function TaskLabelDeleteDialog({
  open,
  onOpenChange,
  label,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: Label | null;
  onDeleted: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (pending || !label) return;
    setPending(true);
    try {
      await deleteLabel(label.id);
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete label",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete label?</AlertDialogTitle>
          <AlertDialogDescription>
            “{label?.name}” will be removed from every task in this project.
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button variant="outline" size="sm" disabled={pending} />}
          >
            Cancel
          </AlertDialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => void handleDelete()}
          >
            {pending ? "Deleting" : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
