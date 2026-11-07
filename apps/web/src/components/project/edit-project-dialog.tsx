import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { i18n } from "@/lib/i18n";
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
  const { t } = useTranslation("project");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader className="gap-1.5 px-3 pt-4 pb-1">
          <DialogTitle>{t("edit.title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("edit.description", {
              name: project?.name ?? t("edit.fallbackName"),
            })}
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
  const { t } = useTranslation("project");
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
        error instanceof Error
          ? error.message
          : i18n.t("project:edit.errors.update"),
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
            {t("edit.nameLabel")}
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
            {t("edit.slugLabel")}
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
            {t("edit.descriptionLabel")}
          </label>
          <textarea
            id="edit-project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t("edit.descriptionPlaceholder")}
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
          {t("edit.cancel")}
        </Button>
        <Button type="submit" disabled={!dirty || saving} size="sm">
          {saving ? t("edit.saving") : t("edit.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
