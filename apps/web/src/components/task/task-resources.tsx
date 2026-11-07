import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Link, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  createTaskResource,
  deleteTaskResource,
  getTaskResources,
  RESOURCE_TITLE_MAX,
} from "@/lib/db/queries";
import { i18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { linkHost } from "./link-host";
import { SectionAddButton } from "./sections/section-add-button";
import { SectionHeader } from "./sections/section-header";
import { sectionRowClass } from "./sections/section-row-class";

/**
 * Task Resources section (current `ExternalLinksAccordion`), adapted:
 * no workspace permissions (single profile, so the add button and dialog
 * always render) and no integration icon/badge branches (every link here
 * is manual). Section header with count, host-line rows with hover-revealed
 * remove, empty state, and add dialog match.
 */
export default function TaskResources({
  taskId,
  disabled = false,
}: {
  taskId: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation("task");
  const [isOpen, setIsOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const resources = useLiveQuery(() => getTaskResources(taskId), [taskId]);

  function resetForm() {
    setUrl("");
    setTitle("");
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open && !adding) {
      resetForm();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding || !url.trim()) return;
    setAdding(true);
    try {
      await createTaskResource(taskId, {
        url,
        ...(title.trim() ? { title: title.trim() } : {}),
      });
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("task:resources.errors.add"),
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteTaskResource(taskId, id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("task:resources.errors.remove"),
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <section className="flex flex-col gap-1">
          <SectionHeader
            title={
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  data-task-action="resources"
                  className="flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("resources.title")}
                  {!isOpen && (
                    <ChevronRight
                      aria-hidden="true"
                      className="size-3 text-muted-foreground"
                    />
                  )}
                </button>
              </CollapsibleTrigger>
            }
            meta={
              (resources?.length ?? 0) > 0 && (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {resources?.length}
                </span>
              )
            }
            action={
              !disabled && (
                <SectionAddButton
                  data-task-action="addLink"
                  aria-label={t("resources.add")}
                  title={t("resources.add")}
                  onClick={() => setDialogOpen(true)}
                />
              )
            }
          />

          <CollapsibleContent>
            {resources === undefined ? null : resources.length > 0 ? (
              <div className="flex flex-col">
                {resources.map((resource) => (
                  <div key={resource.id} className={sectionRowClass}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch outline-none focus-visible:underline"
                    >
                      <Link
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 shrink truncate text-[13px] text-foreground/85 group-hover:text-foreground">
                        {resource.title || resource.url}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground/70 text-xs">
                        {linkHost(resource.url)}
                      </span>
                    </a>
                    {!disabled && (
                      <button
                        type="button"
                        aria-label={t("resources.remove", {
                          name: resource.title || resource.url,
                        })}
                        disabled={deleting}
                        onClick={() => void handleDelete(resource.id)}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 disabled:pointer-events-none"
                      >
                        <X aria-hidden="true" className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-2 py-1 text-muted-foreground text-xs">
                {t("resources.empty")}
              </p>
            )}
          </CollapsibleContent>
        </section>
      </Collapsible>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent showCloseButton={false}>
          <form onSubmit={(event) => void handleSubmit(event)}>
            <DialogHeader>
              <DialogTitle>{t("resources.add")}</DialogTitle>
              <DialogDescription className="sr-only">
                {t("resources.dialogDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 px-6 py-4">
              <div className="grid gap-2">
                <label
                  htmlFor="task-resource-url"
                  className="text-sm font-medium"
                >
                  {t("resources.url")}
                </label>
                <Input
                  id="task-resource-url"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <label
                  htmlFor="task-resource-title"
                  className="text-sm font-medium"
                >
                  {t("resources.titleOptional")}
                </label>
                <Input
                  id="task-resource-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={RESOURCE_TITLE_MAX}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogChange(false)}
                disabled={adding}
              >
                {t("resources.cancel")}
              </Button>
              <Button type="submit" disabled={adding || !url.trim()}>
                {adding ? t("resources.adding") : t("resources.add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
