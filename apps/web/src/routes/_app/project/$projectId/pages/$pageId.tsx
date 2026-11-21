import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { FileQuestion } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { ProjectLayout } from "@/components/common/project-layout";
import { PageDetailHeaderActions } from "@/components/pages/page-detail-header-actions";
import { PageEditorSkeleton } from "@/components/pages/page-editor-skeleton";
import { PageSwitcher } from "@/components/pages/page-switcher";
import {
  BreadcrumbItem,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { db } from "@/lib/db/db";
import { getPageWithContent, listProjectPages } from "@/lib/db/pages";
import { getProject } from "@/lib/db/queries";
import { projectPageDetailRouteHead } from "@/lib/seo";

// The TipTap v3 document editor and its extensions/CSS are heavy; lazy-loading
// keeps them strictly out of the app shell and every non-Pages route bundle.
const PageEditorWorkspace = lazy(
  () => import("@/components/pages/editor/page-editor-workspace"),
);

export const Route = createFileRoute("/_app/project/$projectId/pages/$pageId")({
  component: RouteComponent,
  // Read `db.pages` directly in the loader so TanStack Router's route-tree
  // entry never pulls `@/lib/db/pages` (and future lifecycle/duplication code)
  // into the initial app-shell bundle.
  loader: async ({ params }) => {
    const [project, page] = await Promise.all([
      getProject(params.projectId).catch(() => undefined),
      db.pages.get(params.pageId).catch(() => undefined),
    ]);
    const scopedPage =
      page && page.projectId === params.projectId ? page : undefined;
    return { project, page: scopedPage };
  },
  head: projectPageDetailRouteHead(),
});

function RouteComponent() {
  const { projectId, pageId } = Route.useParams();
  const { t } = useTranslation("pages");
  const [liveTitle, setLiveTitle] = useState<{
    pageId: string;
    title: string;
  } | null>(null);

  const pages = useLiveQuery(
    () => listProjectPages(db, projectId),
    [projectId],
  );
  const pageResult = useLiveQuery(
    async () => (await getPageWithContent(db, pageId, projectId)) ?? null,
    [pageId, projectId],
  );

  if (pageResult === undefined) {
    return (
      <ProjectLayout projectId={projectId} activeView="pages">
        <PageEditorSkeleton />
      </ProjectLayout>
    );
  }

  if (pageResult === null) {
    return (
      <ProjectLayout projectId={projectId} activeView="pages">
        <div className="flex h-full items-center justify-center bg-background p-6">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12">
                <FileQuestion className="size-6" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("notFound.title")}</EmptyTitle>
              <EmptyDescription>{t("notFound.description")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link
                to="/project/$projectId/pages"
                params={{ projectId }}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                {t("notFound.backToPages")}
              </Link>
            </EmptyContent>
          </Empty>
        </div>
      </ProjectLayout>
    );
  }

  const displayTitle =
    liveTitle?.pageId === pageId ? liveTitle.title : pageResult.page.title;

  const breadcrumbExtra = (
    <>
      <BreadcrumbSeparator className="shrink-0" />
      <BreadcrumbItem className="min-w-0">
        <PageSwitcher
          projectId={projectId}
          currentPage={pageResult.page}
          displayTitle={displayTitle}
          pages={pages ?? [pageResult.page]}
        />
      </BreadcrumbItem>
    </>
  );

  const headerActions = (
    <PageDetailHeaderActions
      projectId={projectId}
      page={pageResult.page}
      displayTitle={displayTitle}
    />
  );

  return (
    <ProjectLayout
      projectId={projectId}
      activeView="pages"
      breadcrumbExtra={breadcrumbExtra}
      headerActions={headerActions}
    >
      <Suspense fallback={<PageEditorSkeleton />}>
        {/* Remount per pageId: TanStack Router reuses the component across param
            changes, and pending edits must flush cleanly under the outgoing
            page's id before the next page hydrates. */}
        <PageEditorWorkspace
          key={pageId}
          page={pageResult.page}
          initialContent={pageResult.content}
          onTitleChange={(nextTitle) =>
            setLiveTitle({ pageId, title: nextTitle })
          }
        />
      </Suspense>
    </ProjectLayout>
  );
}
