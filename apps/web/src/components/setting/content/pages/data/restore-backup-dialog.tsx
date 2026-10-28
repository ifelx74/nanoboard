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
  useEffect,
  useRef,
  useState,
} from "react";
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
import {
  applyBackupDocument,
  backupTableCounts,
  parseBackupDocument,
  readWorkspaceCounts,
} from "@/lib/backup/apply";
import { createBackupDocument } from "@/lib/backup/create";
import {
  BACKUP_TABLES,
  type BackupDocument,
  type BackupTableName,
} from "@/lib/backup/types";
import { db } from "@/lib/db/db";
import { toast } from "@/lib/toast";
import { cn, errorMessage } from "@/lib/utils";
import { downloadBackupDocument } from "./download";

const TABLE_LABELS: Record<BackupTableName, string> = {
  projects: "Projects",
  columns: "Columns",
  tasks: "Tasks",
  labels: "Labels",
  taskLabels: "Label assignments",
  taskResources: "Task links",
  stickies: "Stickies",
  whiteboards: "Whiteboards",
};

type Mode = "pick" | "summary";

export function RestoreBackupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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
  }, [open]);

  async function handleFile(file: File) {
    if (parsing) return;
    if (!isJsonFile(file)) {
      setError("Choose a JSON file.");
      return;
    }

    setParsing(true);
    setError(null);
    try {
      const parsed = parseBackupDocument(await file.text());
      setDocument(parsed);
      setCurrentCounts(await readWorkspaceCounts(db));
      setFileName(file.name);
      setMode("summary");
    } catch (cause) {
      setDocument(null);
      setCurrentCounts(null);
      setFileName(null);
      setMode("pick");
      setError(errorMessage(cause, "Could not read this file."));
    } finally {
      setParsing(false);
    }
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
      toast.success("Current data downloaded as a backup.");
    } catch (cause) {
      toast.error(errorMessage(cause, "Could not export the current data."));
    } finally {
      setDownloadingEscape(false);
    }
  }

  async function handleRestore() {
    if (!document || restoring) return;
    setRestoring(true);
    try {
      await applyBackupDocument(db, document);
      toast.success("Workspace restored.");
      globalThis.window.location.reload();
    } catch (cause) {
      // The apply path is atomic — a failure here left the database as it
      // was, so staying in the summary is safe.
      setRestoring(false);
      const message = errorMessage(cause, "Could not restore backup.");
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
  }

  const contains = document ? backupTableCounts(document) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (restoring && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogPopup className="max-w-lg" showCloseButton={!restoring}>
        <DialogHeader>
          <DialogTitle>Restore from backup</DialogTitle>
          <DialogDescription>
            {mode === "summary"
              ? "Restoring replaces everything currently in the app with the backup's contents."
              : "Replace everything in the app with a whole-workspace backup file."}
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
                    Drag and drop a backup JSON file
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A file exported by nanoboard's "Export backup".
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
                  {parsing ? "Reading" : "Select file"}
                </Button>
              </div>
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
                  Change file
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
                  title="Backup contains"
                  counts={contains}
                  tone="default"
                />
                <CountsCard
                  title="Will be destroyed"
                  counts={currentCounts}
                  tone="destructive"
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
                Download current data first
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
              Cancel
            </DialogClose>
          )}
          {mode === "summary" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={restoring}
                onClick={resetToPick}
              >
                Back
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
                {restoring ? "Restoring" : "Restore everything"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
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
}: {
  title: string;
  counts: Record<BackupTableName, number>;
  tone: "default" | "destructive";
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
            <span className="text-muted-foreground">{TABLE_LABELS[key]}</span>
            <span className={cn(tone === "destructive" && "text-destructive")}>
              {counts[key]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
