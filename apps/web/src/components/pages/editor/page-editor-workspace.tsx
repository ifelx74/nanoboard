import type { AnyExtension } from "@tiptap/core";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import type { StarterKitOptions } from "@tiptap/starter-kit";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { db } from "@/lib/db/db";
import { savePageContent, updatePageTitle } from "@/lib/db/pages";
import type { Page, PageContent } from "@/lib/db/schema";
import { i18n } from "@/lib/i18n";
import { createPagesEditorExtensions } from "@/lib/pages/editor-extensions";
import { insertPageTable } from "@/lib/pages/extensions/table-extension";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { PageBlockDragHandle } from "./page-block-drag-handle";
import { PageBubbleMenu } from "./page-bubble-menu";
import {
  createPageCodeTableExtensions,
  createPageTableSlashCommandEntry,
  PAGE_CODE_TABLE_STARTER_KIT_OVERRIDES,
  PAGE_CODE_TABLE_UNIQUE_ID_TYPES,
} from "./page-code-table-config";
import { PageEditorEditableContext } from "./page-editor-context";
import { PageLinkPopover } from "./page-link-popover";
import type { PageSlashCommandAdditionalEntry } from "./page-slash-commands";
import { PageStickyToolbar } from "./page-sticky-toolbar";
import { PageTableToolbar } from "./page-table-toolbar";
import "./pages-editor.css";

const TITLE_AUTOSAVE_DELAY_MS = 500;
const CONTENT_AUTOSAVE_DELAY_MS = 600;

export type PageEditorWorkspaceProps = {
  page: Page;
  initialContent: PageContent;
  /** Called immediately as the user types in the title so header chrome stays in sync. */
  onTitleChange?: (nextTitle: string) => void;
  /** Wide (`1152px`) vs normal (`720px`) document column layout. */
  isFullWidth?: boolean;
  /** Whether the 52px desktop sticky formatting toolbar is shown when editable. */
  isStickyToolbarEnabled?: boolean;
  /** Optional slot above the H1 title (reserved for Ticket 04's page header logo picker). */
  headerTopSlot?: ReactNode;
  /** Optional slot at the right end of the sticky toolbar / top-right corner (Ticket 07 right pane toggle). */
  toolbarRightSlot?: ReactNode;
  /** Optional floating overlay inside `#page-content-container` (Ticket 07 floating outline strip). */
  floatingOverlaySlot?: ReactNode;
  /** Optional Table insert callback wired into Sticky Toolbar (Ticket 05). */
  onInsertTable?: (editor: Editor) => void;
  /** Optional Image insert callback wired into Sticky Toolbar (Ticket 06). */
  onInsertImage?: (editor: Editor) => void;
  /** Optional extra insert buttons slot in Sticky Toolbar. */
  extraInsertSlot?: ReactNode;
  /** Optional StarterKit overrides for downstream extensions (e.g. `codeBlock: false` in Ticket 05). */
  starterKitOverrides?: Partial<StarterKitOptions>;
  /** Extra TipTap extensions contributed by downstream features (Callout, Emoji, Table, Image). */
  extraExtensions?: readonly AnyExtension[];
  /** Extra UniqueID node types contributed by downstream extensions. */
  extraUniqueIdTypes?: readonly string[];
  /** Extra slash command entries merged into General / Colors / Background colors sections. */
  extraSlashCommands?: readonly PageSlashCommandAdditionalEntry[];
  /** Built-in slash command keys to omit if replaced by a downstream extension. */
  disabledSlashCommands?: readonly string[];
  /** Notifies parent consumers when the TipTap editor instance is ready or destroyed. */
  onEditorReady?: (editor: Editor | null) => void;
};

/**
 * Lazy-loaded Page document editor workspace. Remounted per `pageId` via
 * `key={pageId}` in the route so hydration runs cleanly once and pending
 * debounced edits always flush under the originating page's id.
 */
export default function PageEditorWorkspace({
  page,
  initialContent,
  onTitleChange,
  isFullWidth = false,
  isStickyToolbarEnabled = true,
  headerTopSlot,
  toolbarRightSlot,
  floatingOverlaySlot,
  onInsertTable,
  onInsertImage,
  extraInsertSlot,
  starterKitOverrides,
  extraExtensions,
  extraUniqueIdTypes,
  extraSlashCommands,
  disabledSlashCommands,
  onEditorReady,
}: PageEditorWorkspaceProps) {
  const { t } = useTranslation("pages");
  const readOnly = page.isLocked || page.archivedAt !== undefined;
  const readOnlyRef = useRef(readOnly);
  const pageId = page.id;

  const [title, setTitle] = useState(page.title);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const titleRef = useRef(page.title);
  const savedTitleRef = useRef(page.title);
  const titleDirtyRef = useRef(false);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scrollContainerEl, setScrollContainerEl] =
    useState<HTMLDivElement | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const isHydratedRef = useRef(false);
  const contentDirtyRef = useRef(false);
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusTitleEnd = useCallback(() => {
    const input = titleInputRef.current;
    if (!input) return;
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }, []);

  const flushTitle = useCallback(() => {
    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
    }
    if (!titleDirtyRef.current) return;
    const nextTitle = titleRef.current;
    titleDirtyRef.current = false;
    if (nextTitle === savedTitleRef.current) return;

    const previousSaved = savedTitleRef.current;
    savedTitleRef.current = nextTitle;
    void updatePageTitle(db, pageId, nextTitle).catch((error: unknown) => {
      savedTitleRef.current = previousSaved;
      titleDirtyRef.current = true;
      const fallbackError = i18n.t("pages:editor.errors.saveTitle");
      toast.error(error instanceof Error ? error.message : fallbackError);
    });
  }, [pageId]);

  const flushContent = useCallback(() => {
    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
      contentTimerRef.current = null;
    }
    if (!contentDirtyRef.current) return;
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    contentDirtyRef.current = false;

    const json = currentEditor.getJSON();
    void savePageContent(db, pageId, json).catch((error: unknown) => {
      contentDirtyRef.current = true;
      const fallbackError = i18n.t("pages:editor.errors.saveContent");
      toast.error(error instanceof Error ? error.message : fallbackError);
    });
  }, [pageId]);

  const flushAll = useCallback(() => {
    flushTitle();
    flushContent();
  }, [flushTitle, flushContent]);

  const editor = useEditor(
    {
      extensions: createPagesEditorExtensions({
        editable: !readOnly,
        onFocusTitleEnd: focusTitleEnd,
        starterKitOverrides: {
          ...PAGE_CODE_TABLE_STARTER_KIT_OVERRIDES,
          ...starterKitOverrides,
        },
        extraExtensions: [
          ...createPageCodeTableExtensions(),
          ...(extraExtensions ?? []),
        ],
        extraUniqueIdTypes: [
          ...PAGE_CODE_TABLE_UNIQUE_ID_TYPES,
          ...(extraUniqueIdTypes ?? []),
        ],
        extraSlashCommands: [
          createPageTableSlashCommandEntry(),
          ...(extraSlashCommands ?? []),
        ],
        disabledSlashCommands,
      }),
      content: initialContent.contentJson,
      editable: !readOnly,
      onCreate: ({ editor: created }) => {
        editorRef.current = created;
      },
      onUpdate: () => {
        if (!isHydratedRef.current || readOnlyRef.current) return;
        contentDirtyRef.current = true;
        if (contentTimerRef.current) {
          clearTimeout(contentTimerRef.current);
        }
        contentTimerRef.current = setTimeout(
          flushContent,
          CONTENT_AUTOSAVE_DELAY_MS,
        );
      },
    },
    [],
  );

  useEffect(() => {
    editorRef.current = editor;
    if (editor) {
      // Enable autosave after initial mount + UniqueID initialization so
      // simply opening an existing page never triggers a spurious write.
      isHydratedRef.current = true;
    }
    onEditorReady?.(editor ?? null);
    return () => {
      onEditorReady?.(null);
    };
  }, [editor, onEditorReady]);

  useEffect(() => {
    const becameReadOnly = readOnly && !readOnlyRef.current;
    if (becameReadOnly) {
      // Flush edits typed immediately before locking or archiving so nothing
      // within the debounce window is lost.
      flushAll();
    }
    readOnlyRef.current = readOnly;
    if (!editor) return;
    editor.setEditable(!readOnly, false);
  }, [editor, readOnly, flushAll]);

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

  // Flush pending debounced writes on unmount, route/page switch, and pagehide.
  useEffect(() => {
    const handlePageHide = () => {
      flushAll();
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      flushAll();
    };
  }, [flushAll]);

  function handleTitleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    if (readOnly) return;
    // Title is logically single-line; strip newlines from pasted text.
    const nextTitle = event.target.value.replace(/[\r\n]+/g, " ");
    setTitle(nextTitle);
    titleRef.current = nextTitle;
    onTitleChange?.(nextTitle);
    titleDirtyRef.current = true;
    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
    }
    titleTimerRef.current = setTimeout(flushTitle, TITLE_AUTOSAVE_DELAY_MS);
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

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      <PageStickyToolbar
        editor={editor}
        isEditable={!readOnly}
        isFullWidth={isFullWidth}
        isStickyToolbarEnabled={isStickyToolbarEnabled}
        onInsertTable={onInsertTable ?? insertPageTable}
        onInsertImage={onInsertImage}
        extraInsertSlot={extraInsertSlot}
        rightSlot={toolbarRightSlot}
      />

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
          <div className="nb-page-header-container mb-4">
            {headerTopSlot}
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

          <div ref={editorWrapperRef} className="nb-page-editor relative">
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
            <PageEditorEditableContext.Provider value={!readOnly}>
              <EditorContent
                editor={editor}
                aria-label={t("editor.bodyAriaLabel")}
              />
            </PageEditorEditableContext.Provider>
          </div>
        </div>

        {floatingOverlaySlot}
      </div>
    </div>
  );
}
