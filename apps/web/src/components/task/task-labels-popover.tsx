import { useLiveQuery } from "dexie-react-hooks";
import { Check, Pencil, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LABEL_COLORS, resolveLabelColor } from "@/lib/label-color";
import type { LabelColorValue } from "@/lib/label-color";
import {
  attachLabel,
  createLabel,
  detachLabel,
  getProjectLabels,
  getTaskLabels,
  renameLabel,
} from "@/lib/db/queries";
import type { Label, Task } from "@/lib/db/schema";
import { toast } from "@/lib/toast";
import TaskLabelDeleteDialog from "./task-label-delete-dialog";

type PopoverStep = "select" | "color";

function notifyError(error: unknown, fallback: string) {
  toast.error(error instanceof Error ? error.message : fallback);
}

/**
 * Kaneo's labels popover (search, check-toggle, create-then-color), plus
 * inline pencil-rename and delete — Kaneo keeps those on a settings page
 * this app does not have. Multi-toggle: the popover stays open across
 * attaches/detaches and only closes after create; failures toast and stay.
 */
export default function TaskLabelsPopover({
  task,
  children,
}: {
  task: Task;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<PopoverStep>("select");
  const [searchValue, setSearchValue] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [selectedColor, setSelectedColor] = useState<LabelColorValue>("gray");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Label | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const taskLabels = useLiveQuery(() => getTaskLabels(task.id), [task.id]);
  const projectLabels = useLiveQuery(() => getProjectLabels(task.projectId), [
    task.projectId,
  ]);

  const taskLabelIds = useMemo(
    () => new Set((taskLabels ?? []).map((label) => label.id)),
    [taskLabels],
  );

  const filteredLabels = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    // Kaneo preserves palette (creation) order; only the search filters.
    return (projectLabels ?? []).filter((label) =>
      label.name.toLowerCase().includes(query),
    );
  }, [projectLabels, searchValue]);

  const isCreatingNewLabel =
    searchValue.trim() !== "" &&
    !(projectLabels ?? []).some(
      (label) => label.name.toLowerCase() === searchValue.trim().toLowerCase(),
    );

  useEffect(() => {
    if (open && step === "select" && searchInputRef.current) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open, step]);

  function resetPopover() {
    setStep("select");
    setSearchValue("");
    setNewLabelName("");
    setSelectedColor("gray");
    setEditingId(null);
    setEditValue("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setDeleteTarget(null);
      setTimeout(resetPopover, 200);
    }
  }

  async function handleToggle(label: Label) {
    try {
      if (taskLabelIds.has(label.id)) {
        await detachLabel(task.id, label.id);
      } else {
        await attachLabel(task.id, label.id);
      }
    } catch (error) {
      notifyError(error, "Failed to update labels");
    }
  }

  function handleCreateNewClick() {
    setNewLabelName(searchValue.trim());
    setStep("color");
  }

  async function handleColorSelect(color: LabelColorValue) {
    setSelectedColor(color);
    if (!newLabelName.trim()) return;
    try {
      const id = await createLabel(task.projectId, newLabelName, color);
      await attachLabel(task.id, id);
      setOpen(false);
      setTimeout(resetPopover, 200);
    } catch (error) {
      notifyError(error, "Failed to create label");
    }
  }

  function startRename(label: Label) {
    setEditingId(label.id);
    setEditValue(label.name);
  }

  async function commitRename(label: Label) {
    if (editValue.trim() === label.name) {
      setEditingId(null);
      return;
    }
    try {
      await renameLabel(label.id, editValue.trim());
      setEditingId(null);
    } catch (error) {
      notifyError(error, "Failed to rename label");
    }
  }

  function renderSelectStep() {
    return (
      <div className="w-auto">
        <div className="flex items-center gap-2 border-b border-border p-2">
          <Search className="h-3 w-3 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search labels"
            className="h-auto border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="py-1">
          {filteredLabels.length === 0 && searchValue.length === 0 && (
            <span className="px-2 text-xs text-muted-foreground">
              No labels yet
            </span>
          )}
          {filteredLabels.map((label) => (
            <div
              key={label.id}
              className="group flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent/50"
            >
              {editingId === label.id ? (
                <Input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      void commitRename(label);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  aria-label={`Rename ${label.name}`}
                  className="h-6 text-xs"
                />
              ) : (
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => void handleToggle(label)}
                >
                  <div className="flex w-3 shrink-0 justify-center">
                    {taskLabelIds.has(label.id) && (
                      <Check className="h-3 w-3" />
                    )}
                  </div>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: resolveLabelColor(label.color),
                    }}
                  />
                  <span className="max-w-20 truncate">{label.name}</span>
                </button>
              )}
              {editingId !== label.id && (
                <div className="ml-auto hidden shrink-0 items-center gap-0.5 group-hover:flex">
                  <button
                    type="button"
                    aria-label={`Rename ${label.name}`}
                    className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
                    onClick={() => startRename(label)}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${label.name}`}
                    className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
                    onClick={() => setDeleteTarget(label)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
          {isCreatingNewLabel && filteredLabels.length > 0 && (
            <div className="my-1 border-t border-border" />
          )}
          {isCreatingNewLabel && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent/50"
              onClick={handleCreateNewClick}
            >
              <div className="flex w-3 shrink-0 justify-center">
                <Plus className="h-3 w-3" />
              </div>
              <span className="truncate">Create “{searchValue.trim()}”</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderColorStep() {
    return (
      <div className="w-auto">
        <div className="flex items-center justify-between border-b border-border p-2">
          <span className="text-xs font-medium">Choose a color</span>
          <button
            type="button"
            onClick={() => setStep("select")}
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
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent/50 ${selectedColor === color.value ? "bg-accent/30" : ""}`}
              onClick={() => void handleColorSelect(color.value)}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color.color }}
              />
              <span className="truncate">{color.label}</span>
              {selectedColor === color.value && (
                <Check className="ml-auto h-3 w-3" />
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          {step === "select" && renderSelectStep()}
          {step === "color" && renderColorStep()}
        </PopoverContent>
      </Popover>
      <TaskLabelDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
        label={deleteTarget}
        onDeleted={() => setDeleteTarget(null)}
      />
    </>
  );
}
