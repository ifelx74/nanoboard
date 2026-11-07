import { useLiveQuery } from "dexie-react-hooks";
import { CalendarIcon, Check, Plus, Search, Tag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  createLabel,
  createTask,
  getProject,
  getProjectLabels,
} from "@/lib/db/queries";
import type { Column, DueDateString, TaskPriority } from "@/lib/db/schema";
import { TASK_PRIORITIES, startDate as startDateString } from "@/lib/db/schema";
import { getColumnIcon } from "@/lib/column";
import { toDayString } from "@/lib/due-date-status";
import { formatMediumDate } from "@/lib/format";
import { LABEL_COLORS, resolveLabelColor } from "@/lib/label-color";
import type { LabelColorValue } from "@/lib/label-color";
import { i18n } from "@/lib/i18n";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import TaskDescriptionInput from "./task-description-input";

function toISODate(date: Date): DueDateString {
  return toDayString(date) as DueDateString;
}

type LabelsStep = "select" | "color";

function LabelDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: resolveLabelColor(color) }}
    />
  );
}

export default function CreateTaskDialog({
  projectId,
  column,
  open,
  onClose,
}: {
  projectId: string;
  column: Column;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("task");
  const priorityNames: Record<TaskPriority, string> = {
    "no-priority": t("priority.noPriority"),
    low: t("priority.low"),
    medium: t("priority.medium"),
    high: t("priority.high"),
    urgent: t("priority.urgent"),
  };
  const colorNames: Record<LabelColorValue, string> = {
    gray: t("labels.color.gray"),
    "dark-gray": t("labels.color.darkGray"),
    purple: t("labels.color.purple"),
    teal: t("labels.color.teal"),
    green: t("labels.color.green"),
    yellow: t("labels.color.yellow"),
    orange: t("labels.color.orange"),
    pink: t("labels.color.pink"),
    red: t("labels.color.red"),
  };
  const project = useLiveQuery(() => getProject(projectId), [projectId]);
  const palette = useLiveQuery(() => getProjectLabels(projectId), [projectId]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descKey, setDescKey] = useState(0);
  const [priority, setPriority] = useState<TaskPriority>("no-priority");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [createMore, setCreateMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelsStep, setLabelsStep] = useState<LabelsStep>("select");
  const [searchValue, setSearchValue] = useState("");
  const [selectedColor, setSelectedColor] = useState<LabelColorValue>("gray");
  const [newLabelName, setNewLabelName] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const stagedLabels = (palette ?? []).filter((label) =>
    labelIds.includes(label.id),
  );

  const filteredLabels = (palette ?? []).filter((label) =>
    label.name.toLowerCase().includes(searchValue.trim().toLowerCase()),
  );

  const isCreatingNewLabel =
    searchValue.trim() !== "" &&
    !(palette ?? []).some(
      (label) => label.name.toLowerCase() === searchValue.trim().toLowerCase(),
    );

  const hasUnsavedChanges = Boolean(
    title.trim() ||
    description.trim() ||
    priority !== "no-priority" ||
    startDate ||
    dueDate ||
    labelIds.length > 0,
  );

  useEffect(() => {
    if (labelsOpen && labelsStep === "select" && searchInputRef.current) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [labelsOpen, labelsStep]);

  // Submits on Cmd/Ctrl+Enter from anywhere in the dialog.
  useEffect(() => {
    if (!open || discardOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, discardOpen]);

  function handleOpenChange(next: boolean) {
    if (next) return;
    if (hasUnsavedChanges && !submitting) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setDescKey((key) => key + 1);
    setPriority("no-priority");
    setStartDate(undefined);
    setDueDate(undefined);
    setLabelIds([]);
    setLabelsStep("select");
    setSearchValue("");
    setSelectedColor("gray");
    setNewLabelName("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || !title.trim()) return;
    setSubmitting(true);
    try {
      await createTask({
        projectId,
        columnId: column.id,
        title: title.trim(),
        description: description.trim(),
        priority,
        startDate: startDate
          ? startDateString(toISODate(startDate))
          : undefined,
        dueDate: dueDate ? toISODate(dueDate) : undefined,
        labelIds,
      });
      if (createMore) {
        resetForm();
      } else {
        onClose();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("task:create.errors.createTask"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function toggleLabel(id: string) {
    setLabelIds((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id],
    );
  }

  async function handleColorSelect(color: LabelColorValue) {
    setSelectedColor(color);
    if (!newLabelName.trim()) return;
    try {
      const id = await createLabel(projectId, newLabelName.trim(), color);
      setLabelIds((current) => [...current, id]);
      setLabelsOpen(false);
      setTimeout(() => {
        setLabelsStep("select");
        setSearchValue("");
        setNewLabelName("");
        setSelectedColor("gray");
      }, 200);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("task:create.errors.createLabel"),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl flex-col overflow-hidden"
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle asChild>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="font-semibold tracking-wider text-muted-foreground">
                  {project?.slug.toUpperCase() ?? t("create.fallbackSlug")}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="font-medium text-foreground">
                  {t("create.newTask")}
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("create.description")}
          </DialogDescription>
        </DialogHeader>

        <form
          ref={formRef}
          onSubmit={(event) => void handleSubmit(event)}
          className="flex min-h-0 flex-1 flex-col space-y-6"
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6">
            <Input
              unstyled
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder={t("create.titlePlaceholder")}
              className="w-full [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-0 [&_[data-slot=input]]:py-3 [&_[data-slot=input]]:text-2xl [&_[data-slot=input]]:font-semibold [&_[data-slot=input]]:leading-tight [&_[data-slot=input]]:tracking-tight [&_[data-slot=input]]:text-foreground [&_[data-slot=input]]:outline-none [&_[data-slot=input]]:placeholder:text-muted-foreground"
            />

            <div className="min-h-[200px]">
              <TaskDescriptionInput
                key={descKey}
                onMarkdown={setDescription}
                placeholder={t("create.descriptionPlaceholder")}
                className="[&_.tiptap]:min-h-[11rem] [&_.tiptap]:px-0 [&_.tiptap]:pt-1 [&_.tiptap]:pb-2"
              />
            </div>

            {stagedLabels.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {stagedLabels.map((label) => (
                  <Badge
                    key={label.id}
                    variant="outline"
                    className="cursor-pointer gap-1 pl-3 transition-colors hover:bg-accent/50"
                    onClick={() => toggleLabel(label.id)}
                  >
                    <span
                      aria-hidden="true"
                      className="mr-1.5 inline-block h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: resolveLabelColor(label.color),
                      }}
                    />
                    <span className="max-w-20 truncate">{label.name}</span>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 py-2">
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-accent/50 px-2.5 py-1.5 text-xs font-medium text-foreground">
                {getColumnIcon(column.slug, column.isFinal)}
                {column.name}
              </div>

              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent/50",
                      startDate
                        ? "bg-accent/30 text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span>
                      {startDate
                        ? formatMediumDate(startDate)
                        : t("create.startDate")}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      if (date) setStartDateOpen(false);
                    }}
                    className="w-full bg-popover"
                  />
                  {startDate && (
                    <div className="border-t border-border p-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setStartDate(undefined)}
                      >
                        {t("create.clearStartDate")}
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent/50",
                      priority !== "no-priority"
                        ? "bg-accent/30 text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {getPriorityIcon(priority)}
                    <span>{priorityNames[priority]}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start">
                  <div className="space-y-1">
                    {TASK_PRIORITIES.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="flex h-8 w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/50"
                        onClick={() => {
                          setPriority(option);
                          setPriorityOpen(false);
                        }}
                      >
                        {getPriorityIcon(option)}
                        <span className="text-sm capitalize">
                          {priorityNames[option]}
                        </span>
                        {priority === option && (
                          <Check className="ml-auto h-4 w-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent/50",
                      dueDate
                        ? "bg-accent/30 text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span>
                      {dueDate
                        ? formatMediumDate(dueDate)
                        : t("create.dueDate")}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => {
                      setDueDate(date);
                      if (date) setDueDateOpen(false);
                    }}
                    className="w-full bg-popover"
                  />
                  {dueDate && (
                    <div className="border-t border-border p-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setDueDate(undefined)}
                      >
                        {t("create.clearDueDate")}
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent/50",
                      labelIds.length > 0
                        ? "bg-accent/30 text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span>{t("create.labels")}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start">
                  {labelsStep === "select" && (
                    <div className="w-auto">
                      <div className="flex items-center gap-2 border-b border-border p-2">
                        <Search className="h-3 w-3 text-muted-foreground" />
                        <Input
                          ref={searchInputRef}
                          value={searchValue}
                          onChange={(e) => setSearchValue(e.target.value)}
                          placeholder={t("create.searchLabels")}
                          className="h-auto border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
                        />
                      </div>

                      <div className="py-1">
                        {filteredLabels.length === 0 &&
                          searchValue.length === 0 && (
                            <span className="px-2 text-xs text-muted-foreground">
                              {t("create.noLabels")}
                            </span>
                          )}
                        {filteredLabels.map((label) => (
                          <button
                            key={label.id}
                            type="button"
                            className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent/50"
                            onClick={() => toggleLabel(label.id)}
                          >
                            <div className="flex w-3 shrink-0 justify-center">
                              {labelIds.includes(label.id) && (
                                <Check className="h-3 w-3" />
                              )}
                            </div>
                            <LabelDot color={label.color} />
                            <span className="max-w-20 truncate">
                              {label.name}
                            </span>
                          </button>
                        ))}

                        {isCreatingNewLabel && (
                          <div className="my-1 border-t border-border" />
                        )}
                        {isCreatingNewLabel && (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent/50"
                            onClick={() => {
                              setNewLabelName(searchValue.trim());
                              setLabelsStep("color");
                            }}
                          >
                            <div className="flex w-3 shrink-0 justify-center">
                              <Plus className="h-3 w-3" />
                            </div>
                            <span className="truncate">
                              {t("create.createLabel", {
                                name: searchValue.trim(),
                              })}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {labelsStep === "color" && (
                    <div className="w-auto">
                      <div className="flex items-center justify-between border-b border-border p-2">
                        <span className="text-xs font-medium">
                          {t("create.chooseColor")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLabelsStep("select")}
                          className="flex h-4 w-4 items-center justify-center rounded hover:bg-accent/50"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="py-1">
                        {LABEL_COLORS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent/50",
                              selectedColor === color.value && "bg-accent/30",
                            )}
                            onClick={() => void handleColorSelect(color.value)}
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: color.color }}
                            />
                            <span className="truncate">
                              {colorNames[color.value]}
                            </span>
                            {selectedColor === color.value && (
                              <Check className="ml-auto h-3 w-3" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-border bg-background px-6 py-4">
            <div className="mr-auto flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                <input
                  type="checkbox"
                  checked={createMore}
                  onChange={(e) => setCreateMore(e.target.checked)}
                  className="rounded border-border bg-background text-primary transition-[border-color,box-shadow] focus:ring-2 focus:ring-ring focus:ring-offset-0"
                />
                {t("create.createMore")}
              </label>
            </div>

            <Button
              type="button"
              onClick={() => handleOpenChange(false)}
              variant="outline"
              size="sm"
            >
              {t("create.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || submitting}
              size="sm"
              className="disabled:opacity-50"
            >
              {t("create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("create.discardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("create.discardDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button type="button" variant="outline" size="sm" />}
            >
              {t("create.cancel")}
            </AlertDialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onClose}
            >
              {t("create.discard")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
