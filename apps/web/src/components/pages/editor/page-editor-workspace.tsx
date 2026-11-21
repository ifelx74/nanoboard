import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { PanelRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type Ref,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { db } from "@/lib/db/db";
import { pruneOrphanPageAssets } from "@/lib/db/page-assets";
import { savePageContent, updatePageTitle } from "@/lib/db/pages";
import type { Page, PageContent } from "@/lib/db/schema";
import { i18n } from "@/lib/i18n";
import { createDebouncedSaver } from "@/lib/pages/autosave-flush";
import {
  computePageStats,
  extractHeadings,
  extractPageImages,
  type PageHeadingEntry,
  type PageImageEntry,
} from "@/lib/pages/document";
import { createPagesEditorExtensions } from "@/lib/pages/editor-extensions";
import type { PageImageLightboxTarget } from "@/lib/pages/extensions/image-node";
import { insertPageTable } from "@/lib/pages/extensions/table-extension";
import { createPageAssetUrlCache } from "@/lib/pages/object-url-cache";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { PageAssetUrlProvider } from "./page-asset-url-context";
import { PageBlockDragHandle } from "./page-block-drag-handle";
import { PageBubbleMenu } from "./page-bubble-menu";
import {
  createPageCodeTableExtensions,
  createPageTableSlashCommandEntry,
  PAGE_CODE_TABLE_STARTER_KIT_OVERRIDES,
  PAGE_CODE_TABLE_UNIQUE_ID_TYPES,
} from "./page-code-table-config";
import { PageEditorEditableContext } from "./page-editor-context";
import {
  createEmojiCalloutExtensions,
  createEmojiCalloutSlashCommands,
  EMOJI_CALLOUT_UNIQUE_ID_TYPES,
} from "./page-emoji-callout-feature";
import { PageFloatingOutline } from "./page-floating-outline";
import { PageHeaderLogoPicker } from "./page-header-logo-picker";
import { createPageImageFeature } from "./page-image-feature";
import { PageImageLightbox } from "./page-image-lightbox";
import { PageLinkPopover } from "./page-link-popover";
import {
  PageNavigationPane,
  type PageNavigationPaneTab,
} from "./page-navigation-pane";
import { scrollToPageHeading, scrollToPageImage } from "./page-outline-list";
import { PageStickyToolbar } from "./page-sticky-toolbar";
import { PageTableToolbar } from "./page-table-toolbar";
import "./pages-editor.css";

const TITLE_AUTOSAVE_DELAY_MS = 500;
const CONTENT_AUTOSAVE_DELAY_MS = 600;
const LIVE_DOC_SYNC_DELAY_MS = 100;

export interface PageEditorWorkspaceHandle {
  /** Flushes any pending debounced title/body saves and awaits DB commits. */
  flushPendingSaves: () => Promise<void>;
}

export type PageEditorWorkspaceProps = {
  ref?: Ref<PageEditorWorkspaceHandle>;
  page: Page;
  initialContent: PageContent;
  /** Called immediately as the user types in the title so header chrome stays in sync. */
  onTitleChange?: (nextTitle: string) => void;
  /** Wide (`1152px`) vs normal (`720px`) document column layout. */
  isFullWidth?: boolean;
  /** Whether the 52px desktop sticky formatting toolbar is shown when editable. */
  isStickyToolbarEnabled?: boolean;
  /** Notifies parent consumers when the TipTap editor instance is ready or destroyed. */
  onEditorReady?: (editor: Editor | null) => void;
  /** Controlled active tab of the slide-in right navigation pane (`undefined` = closed). */
  activePaneTab?: PageNavigationPaneTab;
  /** Called when the user opens, switches, or closes the right navigation pane. */
  onPaneTabChange?: (tab: PageNavigationPaneTab | undefined) => void;
};

/**
 * Lazy-loaded Page document editor workspace. Remounted per `pageId` via
 * `key={pageId}` in the route so hydration runs cleanly once and pending
 * debounced edits always flush under the originating page's id.
 */
export default function PageEditorWorkspace({
  ref,
  page,
  initialContent,
  onTitleChange,
  isFullWidth = false,
  isStickyToolbarEnabled = true,
  onEditorReady,
  activePaneTab,
  onPaneTabChange,
}: PageEditorWorkspaceProps) {
  const { t } = useTranslation("pages");
  const readOnly = page.isLocked || page.archivedAt !== undefined;
  const readOnlyRef = useRef(readOnly);
  const pageId = page.id;

  const assetUrlCache = useMemo(() => createPageAssetUrlCache(), [pageId]);

  useEffect(() => {
    return () => {
      assetUrlCache.revokeAll();
    };
  }, [assetUrlCache]);

  const [lightboxTarget, setLightboxTarget] =
    useState<PageImageLightboxTarget | null>(null);

  const imageFeature = useMemo(
    () =>
      createPageImageFeature({
        pageId,
        projectId: page.projectId,
        assetUrlCache,
        onOpenLightbox: setLightboxTarget,
      }),
    [pageId, page.projectId, assetUrlCache],
  );

  const [title, setTitle] = useState(page.title);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const titleRef = useRef(page.title);
  const savedTitleRef = useRef(page.title);

  const [scrollContainerEl, setScrollContainerEl] =
    useState<HTMLDivElement | null>(null);
  const [liveDoc, setLiveDoc] = useState<JSONContent>(
    initialContent.contentJson,
  );
  const liveDocTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const isHydratedRef = useRef(false);

  const titleSaver = useMemo(
    () =>
      createDebouncedSaver({
        delayMs: TITLE_AUTOSAVE_DELAY_MS,
        save: async () => {
          const nextTitle = titleRef.current;
          if (nextTitle === savedTitleRef.current) return;
          await updatePageTitle(db, pageId, nextTitle);
          savedTitleRef.current = nextTitle;
        },
        onError: (error) => {
          const fallbackError = i18n.t("pages:editor.errors.saveTitle");
          toast.error(error instanceof Error ? error.message : fallbackError);
        },
      }),
    [pageId],
  );

  const contentSaver = useMemo(
    () =>
      createDebouncedSaver({
        delayMs: CONTENT_AUTOSAVE_DELAY_MS,
        save: async () => {
          const currentEditor = editorRef.current;
          if (!currentEditor) return;
          const json = currentEditor.getJSON();
          await savePageContent(db, pageId, json);
        },
        onError: (error) => {
          const fallbackError = i18n.t("pages:editor.errors.saveContent");
          toast.error(error instanceof Error ? error.message : fallbackError);
        },
      }),
    [pageId],
  );

  const flushTitle = useCallback(() => {
    void titleSaver.flush();
  }, [titleSaver]);

  const flushPendingSaves = useCallback(async () => {
    await Promise.all([titleSaver.flush(), contentSaver.flush()]);
  }, [titleSaver, contentSaver]);

  useImperativeHandle(
    ref,
    () => ({
      flushPendingSaves,
    }),
    [flushPendingSaves],
  );

  const scheduleLiveDocSync = useCallback((currentEditor: Editor) => {
    if (liveDocTimerRef.current) {
      clearTimeout(liveDocTimerRef.current);
    }
    liveDocTimerRef.current = setTimeout(() => {
      liveDocTimerRef.current = null;
      if (!currentEditor.isDestroyed) {
        setLiveDoc(currentEditor.getJSON());
      }
    }, LIVE_DOC_SYNC_DELAY_MS);
  }, []);

  const focusTitleEnd = useCallback(() => {
    const input = titleInputRef.current;
    if (!input) return;
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }, []);

  const editor = useEditor(
    {
      extensions: createPagesEditorExtensions({
        editable: !readOnly,
        onFocusTitleEnd: focusTitleEnd,
        starterKitOverrides: PAGE_CODE_TABLE_STARTER_KIT_OVERRIDES,
        extraExtensions: [
          ...createPageCodeTableExtensions(),
          ...createEmojiCalloutExtensions(),
          imageFeature.extension,
        ],
        extraUniqueIdTypes: [
          ...PAGE_CODE_TABLE_UNIQUE_ID_TYPES,
          ...EMOJI_CALLOUT_UNIQUE_ID_TYPES,
          imageFeature.uniqueIdType,
        ],
        extraSlashCommands: [
          createPageTableSlashCommandEntry(),
          ...createEmojiCalloutSlashCommands(),
          imageFeature.slashCommand,
        ],
      }),
      content: initialContent.contentJson,
      editable: !readOnly,
      onCreate: ({ editor: created }) => {
        editorRef.current = created;
      },
      onUpdate: ({ editor: updated }) => {
        scheduleLiveDocSync(updated);
        if (!isHydratedRef.current || readOnlyRef.current) return;
        contentSaver.schedule();
      },
    },
    [],
  );

  useEffect(() => {
    editorRef.current = editor;
    if (editor) {
      // Enable autosave after initial mount + UniqueID initialization so
      // simply opening an existing page never triggers a spurious write,
      // while still capturing UniqueID attrs for Outline/Assets navigation.
      isHydratedRef.current = true;
      setLiveDoc(editor.getJSON());
    }
    onEditorReady?.(editor ?? null);
    return () => {
      if (liveDocTimerRef.current) {
        clearTimeout(liveDocTimerRef.current);
        liveDocTimerRef.current = null;
      }
      onEditorReady?.(null);
    };
  }, [editor, onEditorReady]);

  // Flush any pending live-doc debounce immediately when opening the right pane.
  useEffect(() => {
    if (!activePaneTab || !editor || editor.isDestroyed) return;
    if (liveDocTimerRef.current) {
      clearTimeout(liveDocTimerRef.current);
      liveDocTimerRef.current = null;
      setLiveDoc(editor.getJSON());
    }
  }, [activePaneTab, editor]);

  useEffect(() => {
    const becameReadOnly = readOnly && !readOnlyRef.current;
    if (becameReadOnly) {
      // Flush edits typed immediately before locking or archiving so nothing
      // within the debounce window is lost.
      void flushPendingSaves();
    }
    readOnlyRef.current = readOnly;
    if (!editor) return;
    editor.setEditable(!readOnly, false);
  }, [editor, readOnly, flushPendingSaves]);

  // Auto-size the H1 title textarea to fit wrapped lines cleanly without scrollbars.
  const syncTitleHeight = useCallback(() => {
    const el = titleInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    syncTitleHeight();
  }, [title, isFullWidth, syncTitleHeight]);

  // Focus the title automatically on newly created untitled empty pages.
  useEffect(() => {
    if (
      !readOnly &&
      page.title === "" &&
      initialContent.contentText === "" &&
      titleInputRef.current
    ) {
      titleInputRef.current.focus();
    }
    // Mount-only check: keyed by pageId.
  }, []);

  // Defensively prune orphan pageAssets left behind by prior crashed sessions
  // without ever racing with fresh uploads created during this session.
  useEffect(() => {
    const mountTimestamp = Date.now();
    void pruneOrphanPageAssets(db, pageId, { olderThan: mountTimestamp }).catch(
      () => {
        // Best-effort defensive hygiene on page load.
      },
    );
  }, [pageId]);

  // Flush pending debounced writes on unmount, route/page switch, and pagehide,
  // then prune unreferenced pageAssets once the latest contentJson has committed.
  useEffect(() => {
    const flushAndPrune = () => {
      void titleSaver.flush();
      const saveResult = contentSaver.flush();
      void saveResult
        .then((savedOk) => {
          if (!savedOk) return undefined;
          return pruneOrphanPageAssets(db, pageId);
        })
        .catch(() => {
          // Best-effort cleanup on unmount/pagehide.
        });
    };
    window.addEventListener("pagehide", flushAndPrune);
    return () => {
      window.removeEventListener("pagehide", flushAndPrune);
      flushAndPrune();
    };
  }, [titleSaver, contentSaver, pageId]);

  function handleTitleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    if (readOnly) return;
    // Title is logically single-line; strip newlines from pasted text.
    const nextTitle = event.target.value.replace(/[\r\n]+/g, " ");
    setTitle(nextTitle);
    titleRef.current = nextTitle;
    onTitleChange?.(nextTitle);
    titleSaver.schedule();
  }

  function focusBodyStart(insertParagraphIfNonEmpty: boolean) {
    if (!editor) return;
    const firstChild = editor.state.doc.firstChild;
    const firstIsEmptyParagraph =
      firstChild?.type.name === "paragraph" && firstChild.content.size === 0;

    if (insertParagraphIfNonEmpty && !firstIsEmptyParagraph && !readOnly) {
      editor.chain().insertContentAt(0, { type: "paragraph" }).focus(1).run();
      return;
    }
    editor.commands.focus("start");
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const el = event.currentTarget;

    if (event.key === "Enter") {
      event.preventDefault();
      focusBodyStart(true);
      return;
    }

    if (event.key === "ArrowRight") {
      if (
        el.selectionStart === el.value.length &&
        el.selectionEnd === el.value.length
      ) {
        event.preventDefault();
        focusBodyStart(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      const lineHeight =
        Number.parseFloat(getComputedStyle(el).lineHeight) || 38;
      const isSingleLine = el.scrollHeight <= lineHeight * 1.5;
      const atEnd =
        el.selectionStart === el.value.length &&
        el.selectionEnd === el.value.length;
      if (isSingleLine || atEnd) {
        event.preventDefault();
        focusBodyStart(false);
      }
    }
  }

  function handleCanvasClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const clickedBlankCanvas =
      target === event.currentTarget || target.dataset.pageCanvas === "true";
    if (!clickedBlankCanvas || !editor || readOnly) return;
    editor.commands.focus("end");
  }

  const headings = useMemo(() => extractHeadings(liveDoc), [liveDoc]);
  const stats = useMemo(() => computePageStats(liveDoc), [liveDoc]);
  const images = useMemo(() => extractPageImages(liveDoc), [liveDoc]);

  const handleSelectHeading = useCallback(
    (heading: PageHeadingEntry) => {
      scrollToPageHeading(scrollContainerEl, heading);
    },
    [scrollContainerEl],
  );

  const handleSelectImage = useCallback(
    (image: PageImageEntry, index: number) => {
      scrollToPageImage(scrollContainerEl, image, index);
    },
    [scrollContainerEl],
  );

  const isPaneOpen = activePaneTab !== undefined;

  const toolbarRightSlot =
    onPaneTabChange && !isPaneOpen ? (
      <TooltipProvider delay={300}>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={t("rightPane.open")}
                onClick={() => onPaneTabChange("outline")}
                className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <PanelRight className="size-3.5" aria-hidden="true" />
              </button>
            }
          />
          <TooltipContent side="left">{t("rightPane.open")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : null;

  return (
    <PageAssetUrlProvider pageId={pageId} cache={assetUrlCache}>
      <div className="relative flex h-full w-full overflow-hidden bg-background">
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <PageStickyToolbar
            editor={editor}
            isEditable={!readOnly}
            isFullWidth={isFullWidth}
            isStickyToolbarEnabled={isStickyToolbarEnabled}
            onInsertTable={insertPageTable}
            onInsertImage={imageFeature.insertImage}
            rightSlot={toolbarRightSlot}
          />

          <div className="nb-page-canvas-shell relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              ref={setScrollContainerEl}
              id="page-content-container"
              data-page-canvas="true"
              className="relative min-h-0 flex-1 overflow-y-auto"
              onClick={handleCanvasClick}
            >
              <div
                data-page-canvas="true"
                className={cn(
                  "nb-page-frame pt-10 pb-64",
                  isFullWidth && "wide-layout",
                )}
              >
                <div className="nb-page-header-container group/page-header mb-4">
                  <PageHeaderLogoPicker
                    page={page}
                    isTitleEmpty={title.trim() === ""}
                    disabled={readOnly}
                  />
                  <textarea
                    ref={titleInputRef}
                    rows={1}
                    value={title}
                    readOnly={readOnly}
                    aria-readonly={readOnly}
                    onChange={handleTitleChange}
                    onKeyDown={handleTitleKeyDown}
                    onBlur={flushTitle}
                    placeholder={t("untitled")}
                    aria-label={t("editor.titleAriaLabel")}
                    className={cn(
                      "block w-full resize-none overflow-hidden bg-transparent text-[2rem] leading-[2.375rem] font-bold tracking-[-0.02em] text-foreground outline-none placeholder:text-muted-foreground/50",
                      readOnly && "cursor-default",
                    )}
                  />
                </div>

                <PageEditorEditableContext.Provider value={!readOnly}>
                  <div
                    ref={editorWrapperRef}
                    className="nb-page-editor relative"
                  >
                    {editor && !readOnly && (
                      <>
                        <PageBubbleMenu
                          editor={editor}
                          scrollTarget={scrollContainerEl}
                        />
                        <PageTableToolbar
                          editor={editor}
                          scrollTarget={scrollContainerEl}
                        />
                        <PageBlockDragHandle editor={editor} />
                      </>
                    )}
                    {editor && (
                      <PageLinkPopover
                        editor={editor}
                        containerRef={editorWrapperRef}
                      />
                    )}
                    <EditorContent
                      editor={editor}
                      aria-label={t("editor.bodyAriaLabel")}
                    />
                  </div>
                </PageEditorEditableContext.Provider>
              </div>
            </div>

            {onPaneTabChange && !isPaneOpen && (
              <PageFloatingOutline
                headings={headings}
                onSelectHeading={handleSelectHeading}
                onOpenOutlinePane={() => onPaneTabChange("outline")}
              />
            )}
          </div>
        </div>

        {onPaneTabChange && (
          <PageNavigationPane
            page={page}
            activeTab={activePaneTab}
            headings={headings}
            stats={stats}
            images={images}
            onTabChange={onPaneTabChange}
            onSelectHeading={handleSelectHeading}
            onSelectImage={handleSelectImage}
          />
        )}
      </div>

      <PageImageLightbox
        target={lightboxTarget}
        onClose={() => setLightboxTarget(null)}
      />
    </PageAssetUrlProvider>
  );
}
