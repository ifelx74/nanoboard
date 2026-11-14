import { ArrowUpFromLine, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { type FormEvent } from "react";
import { useTranslation } from "react-i18next";
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
import { db } from "@/lib/db/db";
import { readProjectTransferSource } from "@/lib/db/queries";
import { buildTaskTransferDocument } from "@/lib/task-transfer/export";
import { sealTaskTransferDocument } from "@/lib/task-transfer/encrypt";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import {
  cryptoAvailable,
  MIN_PASSPHRASE_LENGTH,
  usePassphraseProtection,
} from "@/hooks/use-passphrase-protection";
import {
  downloadTaskTransferDocument,
  downloadTaskTransferText,
} from "./download";

export function ExportTasksDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("project");
  const {
    protection,
    setProtection,
    passphrase,
    setPassphrase,
    confirmPassphrase,
    setConfirmPassphrase,
    showPassphrase,
    setShowPassphrase,
    exporting,
    setExporting,
    passphraseTooShort,
    mismatch,
    canSubmit,
  } = usePassphraseProtection(open);

  async function handleExport() {
    if (exporting || !canSubmit) return;
    setExporting(true);
    try {
      const source = await readProjectTransferSource(db, projectId);
      const document = await buildTaskTransferDocument(source);
      if (protection === "encrypted") {
        const text = await sealTaskTransferDocument(document, passphrase);
        downloadTaskTransferText(text, document.project.slug);
        toast.success(t("export.exportedEncrypted"));
      } else {
        downloadTaskTransferDocument(document);
        toast.success(t("export.exported"));
      }
      // Closing the dialog wipes the passphrase state.
      onOpenChange(false);
    } catch (cause) {
      toast.error(errorMessage(cause, t("export.exportFailed")));
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
          <DialogTitle>{t("export.title")}</DialogTitle>
          <DialogDescription>
            {t("export.description", { name: projectName })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogPanel className="space-y-4">
            {encrypted && (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor="transfer-export-passphrase"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("export.passphrase")}
                  </label>
                  <div className="relative">
                    <Input
                      id="transfer-export-passphrase"
                      type={showPassphrase ? "text" : "password"}
                      autoComplete="new-password"
                      className="h-9 pr-9 text-sm"
                      value={passphrase}
                      disabled={!cryptoAvailable || exporting}
                      onChange={(event) => setPassphrase(event.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-1 cursor-pointer top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                      disabled={!cryptoAvailable || exporting}
                      aria-label={
                        showPassphrase
                          ? t("export.hidePassphrase")
                          : t("export.showPassphrase")
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
                    htmlFor="transfer-export-confirm-passphrase"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("export.confirmPassphrase")}
                  </label>
                  <Input
                    id="transfer-export-confirm-passphrase"
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
                    {t("export.passphraseMismatch")}
                  </p>
                )}
                {passphraseTooShort && (
                  <p role="alert" className="text-xs text-destructive">
                    {t("export.passphraseTooShort", {
                      count: MIN_PASSPHRASE_LENGTH,
                    })}
                  </p>
                )}
                {cryptoAvailable && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="size-5" />
                    {t("export.forgottenPassphrase")}
                  </p>
                )}
                {!cryptoAvailable && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {t("export.cryptoUnavailable")}
                  </p>
                )}
              </>
            )}

            {!encrypted && (
              <>
                <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm flex items-center gap-1 text-muted-foreground">
                  <Info className="size-5" />
                  {t("export.plainWarning")}
                </p>
                {!cryptoAvailable && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {t("export.cryptoUnavailable")}
                  </p>
                )}
              </>
            )}
          </DialogPanel>

          <DialogFooter>
            <div className="mr-auto flex items-center">
              {encrypted ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  disabled={exporting}
                  onClick={() => setProtection("plain")}
                >
                  {t("export.saveUnencryptedInstead")}
                </Button>
              ) : (
                cryptoAvailable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    disabled={exporting}
                    onClick={() => setProtection("encrypted")}
                  >
                    {t("export.protectWithPassphrase")}
                  </Button>
                )
              )}
            </div>
            <DialogClose
              render={<Button variant="outline" size="sm" />}
              disabled={exporting}
            >
              {t("export.cancel")}
            </DialogClose>
            <Button type="submit" size="sm" disabled={exporting || !canSubmit}>
              {exporting ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUpFromLine aria-hidden="true" />
              )}
              {exporting
                ? t("export.exporting")
                : encrypted
                  ? t("export.button")
                  : t("export.saveUnencrypted")}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
