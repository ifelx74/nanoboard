import {
  AlertCircle,
  CheckCircle2,
  FileJson,
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
  getProjectColumns,
  getProjectLabels,
  importProjectTasks,
} from "@/lib/db/queries";
import type { ImportColumn } from "@/lib/task-transfer/types";
import type {
  ImportPlan,
  ImportReport,
  ImportTaskOutcome,
} from "@/lib/task-transfer/types";
import {
  planTaskImport,
  parseTaskImportFile,
} from "@/lib/task-transfer/import";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const EXAMPLE_FORMAT = `{
  "tasks": [
    {
      "title": "Task title",
      "description": "Description text",
      "status": "to-do",
      "priority": "low",
      "startDate": "2025-04-18T00:00:00.000Z",
      "dueDate": "2025-04-20T00:00:00.000Z",
      "userId": null
    }
  ]
}`;

type Mode = "pick" | "preview" | "result";

export function ImportTasksDialog({
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("pick");
  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [columns, setColumns] = useState<ImportColumn[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const pendingCount = plan?.tasks.length ?? 0;

  useEffect(() => {
    if (open) return;
    setMode("pick");
    setFileName(null);
    setPlan(null);
    setColumns([]);
    setReport(null);
    setError(null);
    setDragActive(false);
    setParsing(false);
    setImporting(false);
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
      const items = parseTaskImportFile(await file.text());
      const [projectColumns, projectLabels] = await Promise.all([
        getProjectColumns(projectId),
        getProjectLabels(projectId),
      ]);
      const nextPlan = planTaskImport(items, projectColumns, projectLabels);
      setColumns(projectColumns);
      setPlan(nextPlan);
      setFileName(file.name);
      setReport(null);
      setMode("preview");
    } catch (cause) {
      setPlan(null);
      setReport(null);
      setFileName(null);
      setMode("pick");
      setError(
        cause instanceof Error ? cause.message : "Could not read this file.",
      );
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

  async function handleImport() {
    if (!plan || plan.tasks.length === 0 || importing) return;
    setImporting(true);
    try {
      const written = await importProjectTasks(projectId, plan.tasks);
      const outcomes: ImportTaskOutcome[] = [
        ...plan.failures.map((failure) => ({
          index: failure.index,
          title: failure.title,
          success: false,
          warnings: [],
          error: failure.error,
        })),
        ...written,
      ].sort((a, b) => a.index - b.index);

      const imported = written.filter((outcome) => outcome.success).length;
      const warned = written.filter(
        (outcome) => outcome.success && outcome.warnings.length > 0,
      ).length;
      const failed = outcomes.filter((outcome) => !outcome.success).length;

      setReport({ imported, warned, failed, outcomes });
      setMode("result");
      if (imported > 0) {
        toast.success(`${imported} task${imported === 1 ? "" : "s"} imported.`);
      }
      if (failed > 0) {
        toast.error(
          `${failed} task${failed === 1 ? "" : "s"} could not be imported.`,
        );
      }
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not import tasks.",
      );
    } finally {
      setImporting(false);
    }
  }

  function resetToPick() {
    setMode("pick");
    setFileName(null);
    setPlan(null);
    setReport(null);
    setError(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (importing && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogPopup className="max-w-lg" showCloseButton={!importing}>
        <DialogHeader>
          <DialogTitle>
            {mode === "result" ? "Import complete" : "Import tasks"}
          </DialogTitle>
          <DialogDescription>
            {mode === "result"
              ? `Finished importing into “${projectName}”.`
              : `Add tasks from a JSON file to “${projectName}”.`}
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="space-y-4">
          {mode === "pick" && (
            <>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Expected format</p>
                <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs">
                  {EXAMPLE_FORMAT}
                </pre>
              </div>
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
                    Drag and drop a JSON file
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A full export, a tasks object, or a task array.
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

          {mode === "preview" && plan && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{fileName}</span>
                <button
                  type="button"
                  className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
                  disabled={importing}
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
              <div className="grid grid-cols-3 gap-2 text-center">
                <Count label="Ready" value={planStats(plan).ready} />
                <Count
                  label="Warnings"
                  value={planStats(plan).warned}
                  tone="warning"
                />
                <Count
                  label="Failed"
                  value={planStats(plan).failed}
                  tone="error"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Tasks</p>
                <div className="max-h-64 space-y-1 overflow-auto rounded-sm border border-border p-1">
                  {[...plan.tasks, ...plan.failures]
                    .sort((a, b) => a.index - b.index)
                    .map((item) =>
                      "error" in item ? (
                        <TaskRow
                          key={`failed-${item.index}`}
                          title={item.title}
                          tone="error"
                          detail={item.error}
                        />
                      ) : (
                        <TaskRow
                          key={`task-${item.index}`}
                          title={item.title}
                          tone={item.warnings.length > 0 ? "warning" : "ready"}
                          detail={
                            item.warnings.length > 0
                              ? item.warnings.join(" ")
                              : statusName(item.columnId, columns)
                          }
                        />
                      ),
                    )}
                </div>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </>
          )}

          {mode === "result" && report && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Count label="Imported" value={report.imported} />
                <Count label="Warnings" value={report.warned} tone="warning" />
                <Count label="Failed" value={report.failed} tone="error" />
              </div>
              <div className="max-h-72 space-y-1 overflow-auto rounded-lg border border-border p-1">
                {report.outcomes.map((outcome) => (
                  <TaskRow
                    key={`outcome-${outcome.index}`}
                    title={outcome.title}
                    tone={
                      !outcome.success
                        ? "error"
                        : outcome.warnings.length > 0
                          ? "warning"
                          : "ready"
                    }
                    detail={
                      !outcome.success
                        ? (outcome.error ?? "Import failed.")
                        : outcome.warnings.length > 0
                          ? outcome.warnings.join(" ")
                          : "Imported"
                    }
                  />
                ))}
              </div>
            </>
          )}
        </DialogPanel>

        <DialogFooter>
          {mode === "pick" && (
            <DialogClose render={<Button variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
          )}
          {mode === "preview" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={importing}
                onClick={resetToPick}
              >
                Back
              </Button>
              <Button
                size="sm"
                disabled={importing || pendingCount === 0}
                onClick={() => void handleImport()}
              >
                {importing && (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                )}
                {importing
                  ? "Importing"
                  : `Import ${pendingCount} task${pendingCount === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
          {mode === "result" && (
            <>
              <Button variant="outline" size="sm" onClick={resetToPick}>
                Import another file
              </Button>
              <DialogClose render={<Button size="sm" />}>Done</DialogClose>
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

function planStats(plan: ImportPlan) {
  const warned = plan.tasks.filter((task) => task.warnings.length > 0).length;
  return {
    ready: plan.tasks.length - warned,
    warned,
    failed: plan.failures.length,
  };
}

function statusName(columnId: string, columns: ImportColumn[]): string {
  return columns.find((column) => column.id === columnId)?.name ?? "";
}

function Count({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warning" | "error";
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-2 py-2">
      <p
        className={cn(
          "font-semibold text-lg tabular-nums",
          tone === "warning" && "text-amber-600 dark:text-amber-400",
          tone === "error" && "text-destructive",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function TaskRow({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: "ready" | "warning" | "error";
}) {
  return (
    <div className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm">
      {tone === "error" ? (
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      ) : tone === "warning" ? (
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <p className="truncate">{title}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}
