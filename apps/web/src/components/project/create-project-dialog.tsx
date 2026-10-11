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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createProject, suggestProjectSlug } from "@/lib/db/queries";
import { PROJECT_ICONS } from "@/lib/project-icons";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Kaneo's create-project modal, adapted: no workspace (single profile, so
 * the breadcrumb shows the app name), kebab slug with a wider input. Icon
 * grid, 2xl name, slug box, and footer match.
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
  const [selectedIcon, setSelectedIcon] = useState("Layout");
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const SelectedIcon =
    PROJECT_ICONS[selectedIcon as keyof typeof PROJECT_ICONS] ??
    PROJECT_ICONS.Layout;
  const filteredIcons = Object.entries(PROJECT_ICONS).filter(([iconName]) =>
    iconName.toLowerCase().includes(iconSearch.trim().toLowerCase()),
  );

  function handleClose() {
    if (submitting) return;
    setName("");
    setSlug("");
    setSelectedIcon("Layout");
    setIconPopoverOpen(false);
    setIconSearch("");
    onClose();
  }

  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setName(next);
    setSlug(suggestProjectSlug(next));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || !name.trim() || !slug.trim()) return;
    setSubmitting(true);
    try {
      const id = await createProject({
        name: name.trim(),
        slug: slug.trim(),
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
            <Popover
              open={iconPopoverOpen}
              onOpenChange={(next) => {
                setIconPopoverOpen(next);
                if (!next) setIconSearch("");
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="h-8 w-8 p-0"
                  title="Pick an icon"
                >
                  <SelectedIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-2">
                  <Input
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder="Search icons"
                    className="h-8 text-xs"
                  />
                  <div className="max-h-[280px] overflow-y-auto pr-1">
                    <div className="grid grid-cols-6 gap-1.5">
                      {filteredIcons.map(([iconName, Icon]) => {
                        const isSelected = selectedIcon === iconName;
                        return (
                          <Button
                            key={iconName}
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedIcon(iconName);
                              setIconPopoverOpen(false);
                              setIconSearch("");
                            }}
                            className={cn(
                              "h-10 items-center justify-center rounded-md p-0",
                              isSelected &&
                                "bg-sidebar-accent text-sidebar-accent-foreground",
                            )}
                            title={iconName}
                          >
                            <Icon className="h-4 w-4" />
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

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
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-sm font-medium text-muted-foreground">
                  Slug
                </span>
                <Input
                  id="project-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-project"
                  maxLength={48}
                  className="h-8 min-w-0 flex-1 rounded-lg border-border bg-background text-center text-sm font-semibold transition-colors duration-150"
                  required
                />
              </div>
              <div className="hidden flex-1 text-xs text-muted-foreground opacity-80 sm:block">
                Used in links as {slug || "my-project"}
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
