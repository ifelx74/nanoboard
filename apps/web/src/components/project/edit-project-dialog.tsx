import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getProject, updateProject } from "@/lib/db/queries";
import type { Project } from "@/lib/db/schema";
import { toast } from "@/lib/toast";
import { useLiveQuery } from "dexie-react-hooks";
import ProjectIconPicker from "./project-icon-picker";

/**
 * Project settings in miniature (no settings page in this app): name,
 * slug, icon, and description, saved through the updateProject patch.
 */
export default function EditProjectDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const project = useLiveQuery(() => getProject(projectId), [projectId, open]);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader className="gap-1.5 px-3 pt-4 pb-1">
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription className="sr-only">
            Rename {project?.name ?? "project"}, change its slug, icon, or
            description
          </DialogDescription>
        </DialogHeader>
        {project && (
          <EditProjectForm
            key={project.id + project.updatedAt}
            project={project}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditProjectForm({
  project,
  onDone,
}: {
  project: Project;
  onDone: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [slug, setSlug] = useState(project.slug);
  const [icon, setIcon] = useState(project.icon);
  const [description, setDescription] = useState(project.description ?? "");
  const [saving, setSaving] = useState(false);

  const dirty =
    name.trim() !== project.name ||
    slug.trim().toUpperCase() !== project.slug ||
    icon !== project.icon ||
    (description.trim() || "") !== (project.description ?? "");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !dirty || !name.trim() || !slug.trim()) return;
    setSaving(true);
    try {
      await updateProject(project.id, {
        name: name.trim(),
        slug: slug.trim(),
        icon,
        description: description.trim() ? description.trim() : null,
      });
      onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update project",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
      <div className="space-y-4 px-3 pt-2">
        <ProjectIconPicker selected={icon} onSelect={setIcon} />
        <div className="space-y-1">
          <label
            htmlFor="edit-project-name"
            className="text-xs font-medium text-muted-foreground"
          >
            Name
          </label>
          <Input
            id="edit-project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={100}
            className="h-9 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="edit-project-slug"
            className="text-xs font-medium text-muted-foreground"
          >
            Slug (letters and numbers, max 5, starts with a letter)
          </label>
          <Input
            id="edit-project-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={5}
            className="h-9 text-sm"
            required
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="edit-project-description"
            className="text-xs font-medium text-muted-foreground"
          >
            Description
          </label>
          <textarea
            id="edit-project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What is this project about?"
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          onClick={onDone}
          variant="outline"
          size="sm"
          className="border-border text-foreground hover:bg-accent"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!dirty || saving} size="sm">
          {saving ? "Saving" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
