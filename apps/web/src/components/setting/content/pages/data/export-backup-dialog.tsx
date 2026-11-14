import { Eye, EyeOff, HardDriveDownload, Loader2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createBackupDocument } from "@/lib/backup/create";
import { sealBackupDocument } from "@/lib/backup/encrypt";
import type { BackupDocument } from "@/lib/backup/types";
import { db } from "@/lib/db/db";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { downloadBackupDocument, downloadBackupText } from "./download";

type Protection = "encrypted" | "plain";

/** WebCrypto requires a secure context; plain HTTP on a LAN has none. */
const cryptoAvailable =
  typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";

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

export function ExportBackupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("settings");
  // Encrypted is always the default; when WebCrypto is unavailable the
  // encrypted path renders disabled with the explanation inline, and only the
  // plain opt-out can produce a file — never a silent downgrade.
  const [protection, setProtection] = useState<Protection>("encrypted");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Closing the dialog discards the passphrase completely.
  useEffect(() => {
    if (open) return;
    setProtection("encrypted");
    setPassphrase("");
    setConfirmPassphrase("");
    setShowPassphrase(false);
    setExporting(false);
  }, [open]);

  const trimmedPassphrase = passphrase.trim();
  const trimmedConfirm = confirmPassphrase.trim();
  const mismatch =
    confirmPassphrase.length > 0 && trimmedPassphrase !== trimmedConfirm;
  const canExport =
    protection === "plain" ||
    (cryptoAvailable && trimmedPassphrase.length > 0 && !mismatch);

  async function handleExport() {
    if (exporting || !canExport) return;
    setExporting(true);
    try {
      const document = await createBackupDocument(db);
      if (protection === "encrypted") {
        const text = await sealBackupDocument(document, trimmedPassphrase);
        downloadBackupText(text, document.exportedAt);
        toast.success(t("data.export.exportedEncrypted"), {
          description: `${exportSummary(document, t)}.`,
        });
      } else {
        downloadBackupDocument(document);
        toast.success(t("data.export.exported"), {
          description: `${exportSummary(document, t)}.`,
        });
      }
      // The useEffect on close wipes the passphrase state.
      onOpenChange(false);
    } catch (cause) {
      toast.error(errorMessage(cause, t("data.export.exportFailed")));
      setExporting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleExport();
  }

  const encrypted = protection === "encrypted";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (exporting && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogPopup className="max-w-lg" showCloseButton={!exporting}>
        <DialogHeader>
          <DialogTitle>{t("data.export.title")}</DialogTitle>
          <DialogDescription>{t("data.export.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogPanel className="space-y-4">
            {encrypted && (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor="backup-export-passphrase"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("data.export.passphrase")}
                  </label>
                  <div className="relative">
                    <Input
                      id="backup-export-passphrase"
                      type={showPassphrase ? "text" : "password"}
                      autoComplete="new-password"
                      className="h-9 pr-9 text-sm"
                      value={passphrase}
                      disabled={!cryptoAvailable || exporting}
                      onChange={(event) => setPassphrase(event.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                      disabled={!cryptoAvailable || exporting}
                      aria-label={
                        showPassphrase
                          ? t("data.export.hidePassphrase")
                          : t("data.export.showPassphrase")
                      }
                      onClick={() => setShowPassphrase((value) => !value)}
                    >
                      {showPassphrase ? (
                        <EyeOff aria-hidden="true" className="size-4" />
                      ) : (
                        <Eye aria-hidden="true" className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="backup-export-confirm-passphrase"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("data.export.confirmPassphrase")}
                  </label>
                  <Input
                    id="backup-export-confirm-passphrase"
                    type={showPassphrase ? "text" : "password"}
                    autoComplete="new-password"
                    className="h-9 text-sm"
                    value={confirmPassphrase}
                    disabled={!cryptoAvailable || exporting}
                    onChange={(event) =>
                      setConfirmPassphrase(event.target.value)
                    }
                  />
                </div>
                {mismatch && (
                  <p role="alert" className="text-xs text-destructive">
                    {t("data.export.passphraseMismatch")}
                  </p>
                )}
                {cryptoAvailable && (
                  <p className="text-xs text-muted-foreground">
                    {t("data.export.forgottenPassphrase")}
                  </p>
                )}
                {!cryptoAvailable && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {t("data.export.cryptoUnavailable")}
                  </p>
                )}
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
                  disabled={exporting}
                  onClick={() => setProtection("plain")}
                >
                  {t("data.export.saveUnencryptedInstead")}
                </button>
              </>
            )}

            {!encrypted && (
              <>
                <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  {t("data.export.plainWarning")}
                </p>
                {!cryptoAvailable && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {t("data.export.cryptoUnavailable")}
                  </p>
                )}
                {cryptoAvailable && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
                    disabled={exporting}
                    onClick={() => setProtection("encrypted")}
                  >
                    {t("data.export.protectWithPassphrase")}
                  </button>
                )}
              </>
            )}
          </DialogPanel>

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" size="sm" />}
              disabled={exporting}
            >
              {t("data.export.cancel")}
            </DialogClose>
            <Button type="submit" size="sm" disabled={exporting || !canExport}>
              {exporting ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <HardDriveDownload aria-hidden="true" />
              )}
              {exporting
                ? t("data.export.exporting")
                : encrypted
                  ? t("data.export.button")
                  : t("data.export.saveUnencrypted")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
