import {
  AlertCircle,
  CheckCircle2,
  FileJson,
  HardDriveDownload,
  Loader2,
  Upload,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  UnlockPassphraseFooter,
  UnlockPassphraseForm,
} from "@/components/passphrase/unlock-passphrase-form";
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
import {
  applyBackupDocument,
  backupTableCounts,
  parseBackupDocument,
  readWorkspaceCounts,
} from "@/lib/backup/apply";
import {
  BackupDecryptError,
  isBackupEnvelope,
  openBackupDocument,
  readBackupEnvelope,
} from "@/lib/backup/encrypt";
import { createBackupDocument } from "@/lib/backup/create";
import {
  BACKUP_TABLES,
  type BackupDocument,
  type BackupTableName,
} from "@/lib/backup/types";
import { db } from "@/lib/db/db";
import { MAX_IMPORT_FILE_BYTES } from "@/lib/file";
import { i18n } from "@/lib/i18n";
import { getDateLocale } from "@/lib/i18n/date-locale";
import { cryptoAvailable } from "@/hooks/use-passphrase-protection";
import { toast } from "@/lib/toast";
import { cn, errorMessage } from "@/lib/utils";
import { downloadBackupDocument } from "./download";

type Mode = "pick" | "unlock" | "summary";

export function RestoreBackupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("settings");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("pick");
  const [fileName, setFileName] = useState<string | null>(null);
  const [document, setDocument] = useState<BackupDocument | null>(null);
  const [currentCounts, setCurrentCounts] = useState<Record<
    BackupTableName,
    number
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [downloadingEscape, setDownloadingEscape] = useState(false);
  // Encrypted file held at the unlock step: the file text, its plaintext
  // header metadata for display, and the passphrase (memory only, wiped on
  // close/cancel).
  const [pendingEnvelopeText, setPendingEnvelopeText] = useState<string | null>(
    null,
  );
  const [envelopeMeta, setEnvelopeMeta] = useState<{
    exportedAt?: string;
    appVersion?: string;
  } | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const canUnlock = cryptoAvailable && passphrase.length > 0;

  useEffect(() => {
    if (open) return;
    setMode("pick");
    setFileName(null);
    setDocument(null);
    setCurrentCounts(null);
    setError(null);
    setDragActive(false);
    setParsing(false);
    setRestoring(false);
    setDownloadingEscape(false);
    setPendingEnvelopeText(null);
    setEnvelopeMeta(null);
    setPassphrase("");
    setShowPassphrase(false);
    setUnlocking(false);
    setUnlockError(null);
  }, [open]);

  async function handleFile(file: File) {
    if (parsing) return;
    if (!isJsonFile(file)) {
      setError(t("data.restore.chooseJsonError"));
      return;
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setError(t("data.restore.fileTooLarge"));
      return;
    }

    setParsing(true);
    setError(null);
    try {
      const text = await file.text();
      // An encrypted backup routes to the unlock step; the plaintext header
      // is validated before the passphrase is ever asked for.
      if (isBackupEnvelope(text)) {
        try {
          const envelope = readBackupEnvelope(text);
          setPendingEnvelopeText(text);
          setEnvelopeMeta({
            exportedAt: envelope.exportedAt,
            appVersion: envelope.appVersion,
          });
          setFileName(file.name);
          setDocument(null);
          setCurrentCounts(null);
          setPassphrase("");
          setShowPassphrase(false);
          setUnlockError(null);
          setMode("unlock");
        } catch (cause) {
          setPendingEnvelopeText(null);
          setEnvelopeMeta(null);
          setPassphrase("");
          setShowPassphrase(false);
          setDocument(null);
          setCurrentCounts(null);
          setFileName(null);
          setMode("pick");
          setError(errorMessage(cause, t("data.restore.readFailed")));
        }
        return;
      }
      const parsed = parseBackupDocument(text);
      setDocument(parsed);
      setCurrentCounts(await readWorkspaceCounts(db));
      setFileName(file.name);
      setMode("summary");
    } catch (cause) {
      setPendingEnvelopeText(null);
      setEnvelopeMeta(null);
      setPassphrase("");
      setShowPassphrase(false);
      setDocument(null);
      setCurrentCounts(null);
      setFileName(null);
      setMode("pick");
      setError(errorMessage(cause, t("data.restore.readFailed")));
    } finally {
      setParsing(false);
    }
  }

  async function handleUnlock(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!pendingEnvelopeText || unlocking || !canUnlock) {
      return;
    }
    setUnlocking(true);
    setUnlockError(null);
    let restored: BackupDocument;
    try {
      // Decryption and structural validation happen before anything is
      // written. Any GCM authentication failure surfaces as one ambiguous
      // error; the file stays loaded for unlimited in-place retry.
      restored = await openBackupDocument(pendingEnvelopeText, passphrase);
    } catch (cause) {
      if (cause instanceof BackupDecryptError) {
        setUnlockError(t("data.restore.unlockFailed"));
        setUnlocking(false);
        return;
      }
      // Decrypted fine but failed structural validation: nothing was
      // written, and retrying the passphrase can't help — back to pick.
      setPendingEnvelopeText(null);
      setEnvelopeMeta(null);
      setDocument(null);
      setCurrentCounts(null);
      setFileName(null);
      setPassphrase("");
      setShowPassphrase(false);
      setMode("pick");
      setError(errorMessage(cause, t("data.restore.readFailed")));
      setUnlocking(false);
      return;
    }
    setCurrentCounts(await readWorkspaceCounts(db));
    setDocument(restored);
    setPassphrase("");
    setPendingEnvelopeText(null);
    setShowPassphrase(false);
    setMode("summary");
    setUnlocking(false);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  async function handleDownloadCurrent() {
    if (downloadingEscape) return;
    setDownloadingEscape(true);
    try {
      downloadBackupDocument(await createBackupDocument(db));
      toast.success(t("data.restore.downloaded"));
    } catch (cause) {
      toast.error(errorMessage(cause, t("data.restore.downloadFailed")));
    } finally {
      setDownloadingEscape(false);
    }
  }

  async function handleRestore() {
    if (!document || restoring) return;
    setRestoring(true);
    try {
      await applyBackupDocument(db, document);
      toast.success(t("data.restore.restored"));
      globalThis.window.location.reload();
    } catch (cause) {
      // The apply path is atomic — a failure here left the database as it
      // was, so staying in the summary is safe.
      setRestoring(false);
      const message = errorMessage(cause, t("data.restore.restoreFailed"));
      setError(message);
      toast.error(message);
    }
  }

  function resetToPick() {
    setMode("pick");
    setFileName(null);
    setDocument(null);
    setCurrentCounts(null);
    setError(null);
    setPendingEnvelopeText(null);
    setEnvelopeMeta(null);
    setPassphrase("");
    setShowPassphrase(false);
    setUnlocking(false);
    setUnlockError(null);
  }

  const contains = document ? backupTableCounts(document) : null;

  const tableLabels: Record<BackupTableName, string> = {
    projects: t("data.restore.tables.projects"),
    columns: t("data.restore.tables.columns"),
    tasks: t("data.restore.tables.tasks"),
    labels: t("data.restore.tables.labels"),
    taskLabels: t("data.restore.tables.taskLabels"),
    taskResources: t("data.restore.tables.taskResources"),
    stickies: t("data.restore.tables.stickies"),
    whiteboards: t("data.restore.tables.whiteboards"),
    whiteboardPreviews: t("data.restore.tables.whiteboardPreviews"),
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if ((restoring || unlocking) && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogPopup
        className="max-w-lg"
        showCloseButton={!restoring && !unlocking}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "unlock"
              ? t("data.restore.unlockTitle")
              : t("data.restore.title")}
          </DialogTitle>
          <DialogDescription>
            {mode === "summary"
              ? t("data.restore.descriptionSummary")
              : mode === "unlock"
                ? t("data.restore.unlockDescription")
                : t("data.restore.descriptionPick")}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-4">
          {mode === "pick" && (
            <>
              <div
                className={cn(
                  "flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 px-6 py-8 text-center transition-colors",
                  dragActive && "border-ring bg-muted/60",
                )}
                onDrop={handleDrop}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
              >
                <Upload
                  aria-hidden="true"
                  className="size-8 text-muted-foreground"
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {t("data.restore.dragTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("data.restore.dragHint")}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={parsing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {parsing ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <FileJson aria-hidden="true" />
                  )}
                  {parsing
                    ? t("data.restore.reading")
                    : t("data.restore.selectFile")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("data.restore.encryptedNote")}
              </p>
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
            </>
          )}

          {mode === "unlock" && (
            <UnlockPassphraseForm
              formId="backup-unlock-form"
              inputId="backup-unlock-passphrase"
              fileName={fileName ?? ""}
              passphrase={passphrase}
              showPassphrase={showPassphrase}
              busy={unlocking}
              error={unlockError}
              fileInputRef={fileInputRef}
              onSubmit={(event) => void handleUnlock(event)}
              onPassphraseChange={setPassphrase}
              onTogglePassphraseVisibility={() =>
                setShowPassphrase((value) => !value)
              }
              onFileChange={handleFileChange}
              changeFileLabel={t("data.restore.changeFile")}
              passphraseLabel={t("data.export.passphrase")}
              showPassphraseLabel={t("data.export.showPassphrase")}
              hidePassphraseLabel={t("data.export.hidePassphrase")}
              forgottenPassphraseNote={t("data.export.forgottenPassphrase")}
              cryptoUnavailableLabel={t("data.export.cryptoUnavailable")}
            >
              {(envelopeMeta?.exportedAt || envelopeMeta?.appVersion) && (
                <dl className="space-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  {envelopeMeta.exportedAt && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-muted-foreground">
                        {t("data.restore.unlockExported")}
                      </dt>
                      <dd className="tabular-nums">
                        {formatExportedAt(envelopeMeta.exportedAt)}
                      </dd>
                    </div>
                  )}
                  {envelopeMeta.appVersion && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-muted-foreground">
                        {t("data.restore.unlockAppVersion")}
                      </dt>
                      <dd className="tabular-nums">
                        {envelopeMeta.appVersion}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </UnlockPassphraseForm>
          )}

          {mode === "summary" && contains && currentCounts && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{fileName}</span>
                <button
                  type="button"
                  className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
                  disabled={restoring}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t("data.restore.changeFile")}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={handleFileChange}
              />
              <div className="grid grid-cols-2 gap-3">
                <CountsCard
                  title={t("data.restore.backupContains")}
                  counts={contains}
                  tone="default"
                  tableLabels={tableLabels}
                />
                <CountsCard
                  title={t("data.restore.willBeDestroyed")}
                  counts={currentCounts}
                  tone="destructive"
                  tableLabels={tableLabels}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={restoring || downloadingEscape}
                onClick={() => void handleDownloadCurrent()}
              >
                {downloadingEscape ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <HardDriveDownload aria-hidden="true" />
                )}
                {t("data.restore.downloadCurrent")}
              </Button>
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
            </>
          )}
        </DialogPanel>

        <DialogFooter>
          {mode === "pick" && (
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {t("data.restore.cancel")}
            </DialogClose>
          )}
          {mode === "unlock" && (
            <UnlockPassphraseFooter
              formId="backup-unlock-form"
              busy={unlocking}
              canSubmit={canUnlock}
              cancelLabel={t("data.restore.cancel")}
              submitLabel={t("data.restore.unlock")}
              submittingLabel={t("data.restore.unlocking")}
              onCancel={resetToPick}
            />
          )}
          {mode === "summary" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={restoring}
                onClick={resetToPick}
              >
                {t("data.restore.back")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={restoring}
                onClick={() => void handleRestore()}
              >
                {restoring && (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                )}
                {restoring
                  ? t("data.restore.restoring")
                  : t("data.restore.restoreEverything")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function formatExportedAt(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return format(parsed, "PPp", { locale: getDateLocale(i18n.language) });
}

function isJsonFile(file: File): boolean {
  return (
    file.type === "application/json" ||
    file.name.toLowerCase().endsWith(".json")
  );
}

function CountsCard({
  title,
  counts,
  tone,
  tableLabels,
}: {
  title: string;
  counts: Record<BackupTableName, number>;
  tone: "default" | "destructive";
  tableLabels: Record<BackupTableName, string>;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/30 px-3 py-2",
        tone === "destructive" && "border-destructive/30 bg-destructive/5",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
          tone === "destructive" && "text-destructive",
        )}
      >
        {tone === "destructive" ? (
          <AlertCircle aria-hidden="true" className="size-3.5" />
        ) : (
          <CheckCircle2 aria-hidden="true" className="size-3.5" />
        )}
        {title}
      </p>
      <ul className="mt-1.5 space-y-0.5 text-sm tabular-nums">
        {BACKUP_TABLES.map((key) => (
          <li key={key} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{tableLabels[key]}</span>
            <span className={cn(tone === "destructive" && "text-destructive")}>
              {counts[key]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
