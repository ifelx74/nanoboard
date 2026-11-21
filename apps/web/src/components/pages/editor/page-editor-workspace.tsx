import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { db } from "@/lib/db/db";
import { savePageContent, updatePageTitle } from "@/lib/db/pages";
import type { Page, PageContent } from "@/lib/db/schema";
import { i18n } from "@/lib/i18n";
import { createPagesEditorExtensions } from "@/lib/pages/editor-extensions";
import { toast } from "@/lib/toast";
import "./pages-editor.css";

const TITLE_AUTOSAVE_DELAY_MS = 500;
const CONTENT_AUTOSAVE_DELAY_MS = 600;

export type PageEditorWorkspaceProps = {
  page: Page;
  initialContent: PageContent;
  /** Called immediately as the user types in the title so header chrome stays in sync. */
  onTitleChange?: (nextTitle: string) => void;
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
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("pages:editor.errors.saveTitle"),
      );
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
      toast.error(
        error instanceof Error
          ? error.message
          : i18n.t("pages:editor.errors.saveContent"),
      );
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
  }, [editor]);

  useEffect(() => {
    readOnlyRef.current = readOnly;
    if (!editor) return;
    editor.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  // Auto-size the H1 title textarea to fit wrapped lines cleanly without scrollbars.
  const syncTitleHeight = useCallback(() => {
    const el = titleInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    syncTitleHeight();
  }, [title, syncTitleHeight]);

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
      editor
        .chain()
        .insertContentAt(0, { type: "paragraph" })
        .focus(1)
        .run();
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
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 38;
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
    if (event.target !== event.currentTarget || !editor || readOnly) return;
    editor.commands.focus("end");
  }

  return (
    <div
      id="page-content-container"
      className="h-full overflow-y-auto bg-background"
      onClick={handleCanvasClick}
    >
      <div className="mx-auto max-w-[720px] px-5 pt-10 pb-64 sm:px-8">
        <div className="mb-4">
          <textarea
            ref={titleInputRef}
            rows={1}
            value={title}
            readOnly={readOnly}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            onBlur={flushTitle}
            placeholder={t("untitled")}
            aria-label={t("editor.titleAriaLabel")}
            className="block w-full resize-none overflow-hidden bg-transparent text-[2rem] leading-[2.375rem] font-bold tracking-[-0.02em] text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="nb-page-editor">
          <EditorContent
            editor={editor}
            aria-label={t("editor.bodyAriaLabel")}
          />
        </div>
      </div>
    </div>
  );
}
