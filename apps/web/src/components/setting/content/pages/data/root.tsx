import { HardDriveDownload, RotateCcw } from "lucide-react";
import { useState } from "react";
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

/** "1 task" / "2 tasks"; pass the irregular plural (e.g. "stickies") if any. */
function counted(value: number, one: string, many = `${one}s`): string {
  return `${value} ${value === 1 ? one : many}`;
}

/** Every table's row count, for the export toast. */
function exportSummary(document: BackupDocument): string {
  const t = document.tables;
  return [
    counted(t.projects.length, "project"),
    counted(t.columns.length, "column"),
    counted(t.tasks.length, "task"),
    counted(t.labels.length, "label"),
    counted(t.taskLabels.length, "label assignment"),
    counted(t.taskResources.length, "task link"),
    counted(t.stickies.length, "sticky", "stickies"),
    counted(t.whiteboards.length, "whiteboard"),
  ].join(", ");
}

export const DataSettings = () => {
  const [exporting, setExporting] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  async function handleExportBackup() {
    if (exporting) return;
    setExporting(true);
    try {
      const document = await createBackupDocument(db);
      downloadBackupDocument(document);
      toast.success("Backup exported.", {
        description: `${exportSummary(document)}.`,
      });
    } catch (cause) {
      toast.error(errorMessage(cause, "Could not export backup."));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="size-full">
      <SettingsHeading
        title="Data"
        description="Snapshot your whole workspace into a single JSON file"
      />
      <div className="mt-7 flex w-full flex-col gap-6">
        <section>
          <SettingsControlItem
            title="Export backup"
            description="Download everything — projects, tasks, whiteboards, and stickies — as one JSON file."
            control={
              <Button
                size="sm"
                onClick={handleExportBackup}
                disabled={exporting}
              >
                <HardDriveDownload aria-hidden="true" />
                Export backup
              </Button>
            }
          />
        </section>
        <section>
          <SettingsControlItem
            title="Restore from backup"
            description="Replace everything in the app with the contents of a backup file."
            control={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRestoreOpen(true)}
              >
                <RotateCcw aria-hidden="true" />
                Restore
              </Button>
            }
          />
        </section>
      </div>
      <RestoreBackupDialog open={restoreOpen} onOpenChange={setRestoreOpen} />
    </div>
  );
};
