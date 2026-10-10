import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateTaskDescription } from "@/lib/db/queries";
import type { Task } from "@/lib/db/schema";
import { toast } from "@/lib/toast";

export default function TaskDescription({ task }: { task: Task }) {
  const [value, setValue] = useState(task.description);
  const [saving, setSaving] = useState(false);
  const dirty = value !== task.description;

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await updateTaskDescription(task.id, value);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save description",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setValue(task.description);
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={value}
        rows={6}
        placeholder="Add a description"
        aria-label="Task description"
        onChange={(event) => setValue(event.target.value)}
        className="w-full resize-y border-0 bg-transparent p-0 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
      />
      {dirty && (
        <div className="flex gap-1.5">
          <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Saving" : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
