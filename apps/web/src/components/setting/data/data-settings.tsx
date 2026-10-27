import { HardDriveDownload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createBackupDocument } from "@/lib/backup/create";
import { db } from "@/lib/db/db";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { SettingsControlItem } from "../control-item";
import { downloadBackupDocument } from "./download";

/** "1 task" / "2 tasks"; pass the irregular plural (e.g. "stickies") if any. */
function counted(value: number, one: string, many = `${one}s`): string {
  return `${value} ${value === 1 ? one : many}`;
}

export const DataSettings = () => {
  const [exporting, setExporting] = useState(false);

  async function handleExportBackup() {
    if (exporting) return;
    setExporting(true);
    try {
      const document = await createBackupDocument(db);
      downloadBackupDocument(document);
      toast.success("Backup exported.", {
        description: `${counted(document.tables.projects.length, "project")}, ${counted(document.tables.tasks.length, "task")}, ${counted(document.tables.whiteboards.length, "whiteboard")}, and ${counted(document.tables.stickies.length, "sticky", "stickies")}.`,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not export backup.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="size-full">
      {/* Heading */}
      <div
        className={cn(
          "flex flex-col items-start justify-between gap-4 md:flex-row md:items-center",
        )}
      >
        <div className="flex flex-col items-start gap-1">
          <h6 className="font-medium text-primary">Data</h6>
          <p className="text-xs text-muted-foreground">
            Snapshot your whole workspace into a single JSON file
          </p>
        </div>
      </div>
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
      </div>
    </div>
  );
};
