import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { createProject, suggestProjectKey } from "@/lib/db/queries";
import { toast } from "@/lib/toast";
import ProjectIconPicker from "./project-icon-picker";

/**
 * Kaneo's create-project modal, adapted: no workspace (single profile, so
 * the breadcrumb shows the app name), short uppercase key. Icon
 * grid, 2xl name, key box, and footer match.
 */
export default function CreateProjectDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState("Layout");
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    if (submitting) return;
    setName("");
    setSlug("");
    setSlugTouched(false);
    setSelectedIcon("Layout");
    onClose();
  }

  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setName(next);
    if (!slugTouched) {
      setSlug(suggestProjectKey(next));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || !name.trim() || !slug.trim()) return;
    setSubmitting(true);
    try {
      const id = await createProject({
        name: name.trim(),
        // Untouched suggestions dedupe server-side-style (WR2); an explicit
        // taken key conflicts instead.
        slug: slugTouched ? slug.trim() : undefined,
        icon: selectedIcon,
      });
      handleClose();
      void navigate({
        to: "/project/$projectId/board",
        params: { projectId: id },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create project",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader className="gap-1.5 px-3 pt-4 pb-1">
          <DialogTitle className="sr-only">New project</DialogTitle>
          <Breadcrumb>
            <BreadcrumbList className="gap-1 text-xs">
              <BreadcrumbItem className="font-medium tracking-wide text-muted-foreground">
                NANOBOARD
              </BreadcrumbItem>
              <BreadcrumbSeparator className="[&>svg]:size-3.5" />
              <BreadcrumbItem className="font-medium text-foreground">
                New project
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <DialogDescription className="sr-only">
            Create a new project
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="space-y-6 px-3 pt-2">
            <ProjectIconPicker
              selected={selectedIcon}
              onSelect={setSelectedIcon}
            />

            <Input
              unstyled
              value={name}
              onChange={handleNameChange}
              autoFocus
              placeholder="Project name"
              className="w-full [&_[data-slot=input]]:h-auto [&_[data-slot=input]]:px-0 [&_[data-slot=input]]:py-2 [&_[data-slot=input]]:text-2xl [&_[data-slot=input]]:leading-tight [&_[data-slot=input]]:font-semibold [&_[data-slot=input]]:tracking-tight [&_[data-slot=input]]:text-foreground [&_[data-slot=input]]:placeholder:text-muted-foreground [&_[data-slot=input]]:outline-none"
              required
            />
          </div>

          <div className="space-y-3 px-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-sm font-medium text-muted-foreground">
                  Key
                </span>
                <Input
                  id="project-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                  }}
                  placeholder="PRO"
                  maxLength={5}
                  className="h-8 w-22 rounded-lg border-border bg-background text-center text-sm font-semibold transition-colors duration-150"
                  required
                />
              </div>
              <div className="hidden flex-1 text-xs text-muted-foreground opacity-80 sm:block">
                Tasks show as {slug || "ABC"}-1, {slug || "ABC"}-2, …
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              size="sm"
              className="border-border text-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !slug.trim() || submitting}
              size="sm"
              className="bg-primary hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Creating" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
