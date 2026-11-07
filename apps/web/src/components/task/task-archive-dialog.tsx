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
import { archiveTask } from "@/lib/db/queries";
import { db } from "@/lib/db/db";
import { i18n } from "@/lib/i18n";
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
  const { t } = useTranslation("task");
  const [pending, setPending] = useState(false);

  async function handleArchive() {
    if (pending) return;
    setPending(true);
    try {
      await archiveTask(db, taskId);
      onOpenChange(false);
      const message = i18n.t("task:archive.archived");
      toast.success(message);
    } catch (error) {
      const fallback = i18n.t("task:archive.error");
      toast.error(error instanceof Error ? error.message : fallback);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("archive.title", { taskKey: taskKeyText })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("archive.description", { title: taskTitle })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button variant="outline" size="sm" disabled={pending} />}
          >
            {t("archive.cancel")}
          </AlertDialogClose>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => void handleArchive()}
          >
            {pending ? t("archive.archiving") : t("archive.archive")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
