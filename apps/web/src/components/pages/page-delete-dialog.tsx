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
import { db } from "@/lib/db/db";
import { deletePage } from "@/lib/db/pages";
import { i18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";

export type PageDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  pageTitle: string;
  onDeleted: () => void;
};

/**
 * Confirmation dialog guarding permanent deletion of archived pages.
 */
export function PageDeleteDialog({
  open,
  onOpenChange,
  pageId,
  pageTitle,
  onDeleted,
}: PageDeleteDialogProps) {
  const { t } = useTranslation("pages");
  const [pending, setPending] = useState(false);

  const displayTitle = pageTitle.trim() || t("untitled");

  async function handleDelete() {
    if (pending) return;
    setPending(true);
    try {
      await deletePage(db, pageId);
      const message = i18n.t("pages:actions.deleted");
      toast.success(message);
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("pages:actions.errors.delete"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteDialog.description", { title: displayTitle })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button variant="outline" size="sm" disabled={pending} />}
          >
            {t("deleteDialog.cancel")}
          </AlertDialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => void handleDelete()}
          >
            {pending ? t("deleteDialog.deleting") : t("deleteDialog.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
