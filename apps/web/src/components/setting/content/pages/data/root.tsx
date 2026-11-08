import { HardDriveDownload, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { createBackupDocument } from "@/lib/backup/create";
import type { BackupDocument } from "@/lib/backup/types";
import { db } from "@/lib/db/db";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { SettingsHeading } from "../../../heading";
import { SettingsControlItem } from "../../../control-item";
import { downloadBackupDocument } from "./download";
import { RestoreBackupDialog } from "./restore-backup-dialog";

/** Translated export summary: every table's row count, for the export toast. */
function exportSummary(
  document: BackupDocument,
  t: TFunction<"settings">,
): string {
  const tables = document.tables;
  return [
    t("data.export.summary.projects", { count: tables.projects.length }),
    t("data.export.summary.columns", { count: tables.columns.length }),
    t("data.export.summary.tasks", { count: tables.tasks.length }),
    t("data.export.summary.labels", { count: tables.labels.length }),
    t("data.export.summary.labelAssignments", {
      count: tables.taskLabels.length,
    }),
    t("data.export.summary.taskLinks", { count: tables.taskResources.length }),
    t("data.export.summary.stickies", { count: tables.stickies.length }),
    t("data.export.summary.whiteboards", { count: tables.whiteboards.length }),
  ].join(", ");
}

export const DataSettings = () => {
  const { t } = useTranslation("settings");
  const [exporting, setExporting] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  async function handleExportBackup() {
    if (exporting) return;
    setExporting(true);
    try {
      const document = await createBackupDocument(db);
      downloadBackupDocument(document);
      toast.success(t("data.export.exported"), {
        description: `${exportSummary(document, t)}.`,
      });
    } catch (cause) {
      toast.error(errorMessage(cause, t("data.export.exportFailed")));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="size-full">
      <SettingsHeading
        title={t("data.title")}
        description={t("data.description")}
      />
      <div className="mt-7 flex w-full flex-col gap-6">
        <section>
          <SettingsControlItem
            title={t("data.export.title")}
            description={t("data.export.description")}
            control={
              <Button
                size="sm"
                onClick={handleExportBackup}
                disabled={exporting}
              >
                <HardDriveDownload aria-hidden="true" />
                {t("data.export.button")}
              </Button>
            }
          />
        </section>
        <section>
          <SettingsControlItem
            title={t("data.restore.title")}
            description={t("data.restoreDescription")}
            control={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRestoreOpen(true)}
              >
                <RotateCcw aria-hidden="true" />
                {t("data.restore.restoreEverything")}
              </Button>
            }
          />
        </section>
      </div>
      <RestoreBackupDialog open={restoreOpen} onOpenChange={setRestoreOpen} />
    </div>
  );
};
