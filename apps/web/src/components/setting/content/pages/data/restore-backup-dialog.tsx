import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
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
import { Input } from "@/components/ui/input";
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
import { i18n } from "@/lib/i18n";
import { getDateLocale } from "@/lib/i18n/date-locale";
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
    exportedAt: string;
    appVersion: string;
  } | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const trimmedPassphrase = passphrase.trim();

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
    if (!pendingEnvelopeText || unlocking || trimmedPassphrase.length === 0) {
      return;
    }
    setUnlocking(true);
    setUnlockError(null);
    let restored: BackupDocument;
    try {
      // Decryption and structural validation happen before anything is
      // written. Any GCM authentication failure surfaces as one ambiguous
      // error; the file stays loaded for unlimited in-place retry.
      restored = await openBackupDocument(
        pendingEnvelopeText,
        trimmedPassphrase,
      );
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
            <form
              id="backup-unlock-form"
              onSubmit={(event) => void handleUnlock(event)}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{fileName}</span>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
                    disabled={unlocking}
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
                {envelopeMeta && (
                  <dl className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-xs text-muted-foreground">
                        {t("data.restore.unlockExported")}
                      </dt>
                      <dd className="tabular-nums">
                        {formatExportedAt(envelopeMeta.exportedAt)}
                      </dd>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <dt className="text-xs text-muted-foreground">
                        {t("data.restore.unlockAppVersion")}
                      </dt>
                      <dd className="tabular-nums">
                        {envelopeMeta.appVersion}
                      </dd>
                    </div>
                  </dl>
                )}
                <div className="space-y-2">
                  <label
                    htmlFor="backup-unlock-passphrase"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("data.export.passphrase")}
                  </label>
                  <div className="relative">
                    <Input
                      id="backup-unlock-passphrase"
                      type={showPassphrase ? "text" : "password"}
                      autoComplete="off"
                      className="h-9 pr-9 text-sm"
                      value={passphrase}
                      disabled={unlocking}
                      onChange={(event) => setPassphrase(event.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                      disabled={unlocking}
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
                {unlockError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {unlockError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("data.export.forgottenPassphrase")}
                </p>
              </div>
            </form>
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
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={unlocking}
                onClick={resetToPick}
              >
                {t("data.restore.cancel")}
              </Button>
              <Button
                type="submit"
                form="backup-unlock-form"
                size="sm"
                disabled={unlocking || trimmedPassphrase.length === 0}
              >
                {unlocking && (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                )}
                {unlocking
                  ? t("data.restore.unlocking")
                  : t("data.restore.unlock")}
              </Button>
            </>
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
