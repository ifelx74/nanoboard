import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ProjectLayout } from "@/components/common/project-layout";
import { PageLogoIcon } from "@/components/pages/page-logo";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { db } from "@/lib/db/db";
import { createPage, listProjectPages } from "@/lib/db/pages";
import { getProject } from "@/lib/db/queries";
import { formatMediumDate } from "@/lib/format";
import { i18n } from "@/lib/i18n";
import { projectRouteHead } from "@/lib/seo";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_app/project/$projectId/pages/")({
  component: RouteComponent,
  loader: ({ params }) => getProject(params.projectId).catch(() => undefined),
  head: projectRouteHead("pages"),
});

function PagesListSkeleton() {
  return (
    <div className="h-full overflow-auto bg-background" aria-hidden="true">
      {["skeleton-row-0", "skeleton-row-1", "skeleton-row-2"].map((key) => (
        <div
          key={key}
          className="flex min-h-[52px] items-center gap-3 border-b border-border/60 px-4 py-2"
        >
          <div className="size-4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function RouteComponent() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("pages");
  const [isCreating, setIsCreating] = useState(false);

  const pages = useLiveQuery(
    () => listProjectPages(db, projectId),
    [projectId],
  );

  async function handleCreatePage() {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const pageId = await createPage(db, projectId);
      void navigate({
        to: "/project/$projectId/pages/$pageId",
        params: { projectId, pageId },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("pages:list.errors.create"),
      );
    } finally {
      setIsCreating(false);
    }
  }

  const addPageButton = (
    <Button
      size="sm"
      disabled={isCreating}
      onClick={() => void handleCreatePage()}
    >
      <Plus className="size-3.5" aria-hidden="true" />
      {t("list.addPage")}
    </Button>
  );

  return (
    <ProjectLayout
      projectId={projectId}
      activeView="pages"
      headerActions={addPageButton}
    >
      {pages === undefined ? (
        <PagesListSkeleton />
      ) : pages.length === 0 ? (
        <div className="flex h-full items-center justify-center bg-background p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12">
                <FileText className="size-6" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("list.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("list.emptyDescription")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                size="sm"
                disabled={isCreating}
                onClick={() => void handleCreatePage()}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {t("list.addPage")}
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col overflow-hidden bg-background">
          <div className="flex-1 overflow-y-auto">
            {pages.map((page) => {
              const displayTitle = page.title.trim() || t("untitled");
              const updatedDate = formatMediumDate(new Date(page.updatedAt));
              return (
                <Link
                  key={page.id}
                  to="/project/$projectId/pages/$pageId"
                  params={{ projectId, pageId: page.id }}
                  className="flex min-h-[52px] items-center justify-between gap-4 border-b border-border/60 px-4 py-2 text-[13px] transition-colors hover:bg-accent/50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <PageLogoIcon logo={page.logo} />
                    <span className="truncate font-medium text-foreground">
                      {displayTitle}
                    </span>
                  </div>
                  <span
                    title={t("list.updatedOn", { date: updatedDate })}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {updatedDate}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </ProjectLayout>
  );
}
