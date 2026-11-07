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
import { archiveCompletedTasks } from "@/lib/db/queries";
import { archiveCompletedTasksInColumn } from "@/lib/db/queries";
import { db } from "@/lib/db/db";
import { i18n } from "@/lib/i18n";
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
  const { t } = useTranslation("task");
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
        const message = i18n.t("task:archiveCompleted.noTasks");
        toast.info(message);
      } else {
        const message = i18n.t("task:archiveCompleted.archived", { count });
        toast.success(message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("task:archiveCompleted.error"),
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
            {t("archiveCompleted.title", { count: eligibleCount })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("archiveCompleted.description", {
              subject:
                eligibleCount === 1
                  ? t("archiveCompleted.subjectOne")
                  : t("archiveCompleted.subjectOther"),
              source: columnName ?? t("archiveCompleted.completedColumns"),
              restoreTarget:
                eligibleCount === 1
                  ? t("archiveCompleted.restoreOne")
                  : t("archiveCompleted.restoreOther"),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button variant="outline" size="sm" disabled={pending} />}
          >
            {t("archiveCompleted.cancel")}
          </AlertDialogClose>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => void handleArchive()}
          >
            {pending
              ? t("archiveCompleted.archiving")
              : t("archiveCompleted.archive")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
