import type { TFunction } from "i18next";
import {
  AlertTriangle,
  HardDrive,
  HardDriveDownload,
  type LucideIcon,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStorageEstimate } from "@/hooks/use-storage-estimate";
import {
  formatBackupAge,
  formatBytes,
  getStorageAlertLevel,
  type StorageAlertLevel,
} from "@/lib/backup/storage-status";
import { cn } from "@/lib/utils";
import { useBackupStatusStore } from "@/store/backup-status";

const ExportBackupDialog = lazy(() =>
  import("@/components/setting/content/pages/data/export-backup-dialog").then(
    (module) => ({ default: module.ExportBackupDialog }),
  ),
);

const CLOCK_TICK_MS = 60_000;

interface AlertStyle {
  Icon: LucideIcon;
  getTitle: (t: TFunction<"navigation">) => string;
  cardClass: string;
  iconClass: string;
  titleClass: string;
  metaClass: string;
  downloadClass: string;
}

const STORAGE_ALERT_STYLES: Record<StorageAlertLevel, AlertStyle> = {
  normal: {
    Icon: HardDrive,
    getTitle: (t) => t("storageStatus.title"),
    cardClass:
      "border-sidebar-border/80 bg-sidebar-accent/40 hover:bg-sidebar-accent",
    iconClass: "text-muted-foreground",
    titleClass: "text-sidebar-foreground",
    metaClass: "text-muted-foreground",
    downloadClass:
      "text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
  },
  warning: {
    Icon: AlertTriangle,
    getTitle: (t) => t("storageStatus.warningTitle"),
    cardClass: "border-warning/35 bg-warning/10 hover:bg-warning/15",
    iconClass: "text-warning-foreground",
    titleClass: "text-warning-foreground",
    metaClass: "text-warning-foreground/80",
    downloadClass:
      "text-warning-foreground/80 opacity-80 group-hover:opacity-100",
  },
};

function useMinuteClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return undefined;

    const tick = () => setNow(Date.now());
    tick();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        tick();
      }
    }, CLOCK_TICK_MS);

    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active]);

  return now;
}

export function SidebarStorageStatus() {
  const { t } = useTranslation("navigation");
  const [exportOpen, setExportOpen] = useState(false);
  const lastBackupAt = useBackupStatusStore((state) => state.lastBackupAt);
  const { bytes, quota, isApproximate } = useStorageEstimate();
  const now = useMinuteClock(lastBackupAt !== null);

  const alertLevel = getStorageAlertLevel({ bytes, quota, lastBackupAt, now });
  const style = STORAGE_ALERT_STYLES[alertLevel];
  const { Icon } = style;

  const sizeLabel =
    bytes === null
      ? null
      : isApproximate
        ? t("storageStatus.approximateSize", {
            size: formatBytes(bytes),
          })
        : formatBytes(bytes);

  let backupLabel: string;
  if (lastBackupAt === null) {
    backupLabel = t("storageStatus.neverBackedUp");
  } else {
    const age = formatBackupAge(lastBackupAt, now);
    backupLabel = t("storageStatus.lastBackup", {
      time: age.kind === "justNow" ? t("storageStatus.justNow") : age.text,
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setExportOpen(true)}
        aria-label={t("storageStatus.backupAction")}
        className={cn(
          "group flex w-full flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          style.cardClass,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5 text-xs font-medium",
              style.titleClass,
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn("size-3.5 shrink-0", style.iconClass)}
            />
            <span className="truncate">{style.getTitle(t)}</span>
          </span>
          {sizeLabel !== null && (
            <span
              className={cn(
                "shrink-0 text-[11px] tabular-nums",
                style.metaClass,
              )}
            >
              {sizeLabel}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-[11px]", style.metaClass)}>
            {backupLabel}
          </span>
          <HardDriveDownload
            aria-hidden="true"
            className={cn(
              "size-3 shrink-0 transition-opacity",
              style.downloadClass,
            )}
          />
        </div>
      </button>

      {exportOpen && (
        <Suspense fallback={null}>
          <ExportBackupDialog open={exportOpen} onOpenChange={setExportOpen} />
        </Suspense>
      )}
    </>
  );
}
