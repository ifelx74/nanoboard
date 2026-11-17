import { HardDriveDownload, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SettingsHeading } from "../../../heading";
import { SettingsControlItem } from "../../../control-item";
import { ExportBackupDialog } from "./export-backup-dialog";
import { RestoreBackupDialog } from "./restore-backup-dialog";

export const DataSettings = () => {
  const { t } = useTranslation("settings");
  const [exportOpen, setExportOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

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
              <Button size="sm" onClick={() => setExportOpen(true)}>
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
      <ExportBackupDialog open={exportOpen} onOpenChange={setExportOpen} />
      <RestoreBackupDialog open={restoreOpen} onOpenChange={setRestoreOpen} />
    </div>
  );
};
