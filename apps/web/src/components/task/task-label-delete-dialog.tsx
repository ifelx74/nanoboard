import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { i18n } from "@/lib/i18n";
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
  const { t } = useTranslation("task");
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
        error instanceof Error
          ? error.message
          : i18n.t("task:labels.deleteDialog.error"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("labels.deleteDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("labels.deleteDialog.description", { name: label?.name ?? "" })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button variant="outline" size="sm" disabled={pending} />}
          >
            {t("labels.deleteDialog.cancel")}
          </AlertDialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => void handleDelete()}
          >
            {pending
              ? t("labels.deleteDialog.deleting")
              : t("labels.deleteDialog.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
