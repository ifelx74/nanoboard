import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { Editor } from "@tiptap/react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Clipboard,
  Download,
  FileQuestion,
  MoveHorizontal,
  PanelTop,
} from "lucide-react";
import { lazy, Suspense, useCallback, useRef, useState } from "react";
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Switch } from "@/components/ui/switch";
import { usePageDisplayPrefs } from "@/hooks/use-page-display-prefs";
import { db } from "@/lib/db/db";
import {
  getPageWithContent,
  isPageArchived,
  listProjectPages,
} from "@/lib/db/pages";
import { getProject } from "@/lib/db/queries";
import { projectPageDetailRouteHead } from "@/lib/seo";

// The TipTap v3 document editor and its extensions/CSS are heavy; lazy-loading
// keeps them strictly out of the app shell and every non-Pages route bundle.
const PageEditorWorkspace = lazy(
  () => import("@/components/pages/editor/page-editor-workspace"),
);

const ExportPageModal = lazy(
  () => import("@/components/pages/export-page-modal"),
);

type PagePaneTab = "outline" | "info" | "assets";

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
  // Keep validateSearch inline so the route tree never pulls lazy Pages editor
  // modules into the initial app-shell bundle.
  validateSearch: (
    search: Record<string, unknown>,
  ): { paneTab?: PagePaneTab } => ({
    paneTab:
      search.paneTab === "outline" ||
      search.paneTab === "info" ||
      search.paneTab === "assets"
        ? search.paneTab
        : undefined,
  }),
});

function RouteComponent() {
  const { projectId, pageId } = Route.useParams();
  const { paneTab } = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useTranslation("pages");
  const {
    isFullWidth,
    isStickyToolbarEnabled,
    setIsFullWidth,
    setIsStickyToolbarEnabled,
  } = usePageDisplayPrefs();
  const [liveTitle, setLiveTitle] = useState<{
    pageId: string;
    title: string;
  } | null>(null);
  const [exportModalPageId, setExportModalPageId] = useState<string | null>(
    null,
  );
  const editorRef = useRef<{ pageId: string; editor: Editor } | null>(null);

  const handleEditorReady = useCallback(
    (editor: Editor | null) => {
      editorRef.current = editor ? { pageId, editor } : null;
    },
    [pageId],
  );

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

  const readOnly = pageResult.page.isLocked || isPageArchived(pageResult.page);
  const displayTitle =
    liveTitle?.pageId === pageId ? liveTitle.title : pageResult.page.title;
  const exportModalOpen = exportModalPageId === pageId;

  const getCurrentContentJson = () => {
    const active = editorRef.current;
    if (active && active.pageId === pageId && !active.editor.isDestroyed) {
      return active.editor.getJSON();
    }
    return pageResult.content.contentJson;
  };

  async function handleCopyMarkdown() {
    const { copyPageMarkdownToClipboard } =
      await import("@/lib/pages/export-page");
    await copyPageMarkdownToClipboard(db, pageId, getCurrentContentJson());
  }

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

  const optionsTopSlot = (
    <>
      <DropdownMenuItem
        closeOnClick={false}
        onClick={() => setIsFullWidth(!isFullWidth)}
        className="justify-between"
      >
        <span className="flex items-center gap-1.5">
          <MoveHorizontal className="size-4" aria-hidden="true" />
          <span>{t("detail.display.fullWidth")}</span>
        </span>
        <Switch
          checked={isFullWidth}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none"
        />
      </DropdownMenuItem>
      {!readOnly && (
        <DropdownMenuItem
          closeOnClick={false}
          onClick={() => setIsStickyToolbarEnabled(!isStickyToolbarEnabled)}
          className="justify-between"
        >
          <span className="flex items-center gap-1.5">
            <PanelTop className="size-4" aria-hidden="true" />
            <span>{t("detail.display.stickyToolbar")}</span>
          </span>
          <Switch
            checked={isStickyToolbarEnabled}
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none"
          />
        </DropdownMenuItem>
      )}
    </>
  );

  const optionsBeforeCopySlot = (
    <DropdownMenuItem onClick={() => void handleCopyMarkdown()}>
      <Clipboard aria-hidden="true" />
      {t("detail.copyMarkdown")}
    </DropdownMenuItem>
  );

  const optionsBottomSlot = (
    <DropdownMenuItem onClick={() => setExportModalPageId(pageId)}>
      <Download aria-hidden="true" />
      {t("detail.export")}
    </DropdownMenuItem>
  );

  const headerActions = (
    <PageDetailHeaderActions
      projectId={projectId}
      page={pageResult.page}
      displayTitle={displayTitle}
      optionsTopSlot={optionsTopSlot}
      optionsBeforeCopySlot={optionsBeforeCopySlot}
      optionsBottomSlot={optionsBottomSlot}
    />
  );

  function handlePaneTabChange(nextTab: PagePaneTab | undefined) {
    if (nextTab === paneTab) return;
    void navigate({
      to: "/project/$projectId/pages/$pageId",
      params: { projectId, pageId },
      search: nextTab ? { paneTab: nextTab } : {},
      replace: true,
    });
  }

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
          isFullWidth={isFullWidth}
          isStickyToolbarEnabled={isStickyToolbarEnabled}
          activePaneTab={paneTab}
          onPaneTabChange={handlePaneTabChange}
          onTitleChange={(nextTitle) =>
            setLiveTitle({ pageId, title: nextTitle })
          }
          onEditorReady={handleEditorReady}
        />
      </Suspense>
      {exportModalOpen && (
        <Suspense fallback={null}>
          <ExportPageModal
            open={exportModalOpen}
            onOpenChange={(open) => setExportModalPageId(open ? pageId : null)}
            pageId={pageId}
            pageTitle={displayTitle}
            getContentJson={getCurrentContentJson}
          />
        </Suspense>
      )}
    </ProjectLayout>
  );
}
