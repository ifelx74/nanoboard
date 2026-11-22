import type { Editor } from "@tiptap/react";
import { Check, Copy, Globe, Pencil, Unlink } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent } from "@/components/ui/popover";
import {
  findLinkMarkRange,
  updateLinkRange,
} from "@/lib/pages/editor-commands";
import type { PageLinkStorage } from "@/lib/pages/extensions/link-extension";
import {
  isSafeLinkHref,
  normalizeLinkHref,
  truncateLinkDisplay,
} from "@/lib/pages/links";
import { cn } from "@/lib/utils";
import { usePageEditorEditable } from "./page-editor-context";

type LinkPopoverMode = "preview" | "edit";

interface ActiveLinkState {
  anchor: HTMLAnchorElement;
  from: number;
  to: number;
  url: string;
  text: string;
}

const HOVER_CLOSE_DELAY_MS = 350;
const COPY_FEEDBACK_MS = 1_000;

function getLinkStorage(editor: Editor): PageLinkStorage | undefined {
  return (editor.storage as { link?: PageLinkStorage }).link;
}

export interface PageLinkPopoverProps {
  editor: Editor;
  containerRef: RefObject<HTMLDivElement | null>;
}

/**
 * Plane-styled link hover preview card (Globe, truncated URL, Copy, Edit,
 * Unlink) and inline edit form (URL, display text, Remove link).
 * In read-only mode, keeps Globe + URL + Copy active and hides Edit/Unlink.
 */
export function PageLinkPopover({
  editor,
  containerRef,
}: PageLinkPopoverProps) {
  const { t } = useTranslation("pages");
  const isEditable = usePageEditorEditable(editor);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<LinkPopoverMode>("preview");
  const [activeLink, setActiveLink] = useState<ActiveLinkState | null>(null);
  const [copied, setCopied] = useState(false);

  const [editUrl, setEditUrl] = useState("");
  const [editText, setEditText] = useState("");
  const [urlError, setUrlError] = useState(false);

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeRef = useRef<LinkPopoverMode>("preview");
  modeRef.current = mode;
  const openRef = useRef(false);
  openRef.current = open;

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closePopover = useCallback(() => {
    clearCloseTimer();
    setOpen(false);
    setMode("preview");
    setUrlError(false);
    const storage = getLinkStorage(editor);
    if (storage) storage.isPreviewOpen = false;
  }, [clearCloseTimer, editor]);

  const scheduleClose = useCallback(() => {
    if (modeRef.current === "edit") return;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closePopover();
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimer, closePopover]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [clearCloseTimer]);

  // Immediately exit link edit mode if the page becomes locked/archived.
  useEffect(() => {
    if (!isEditable && mode === "edit") {
      setMode("preview");
      setUrlError(false);
    }
  }, [isEditable, mode]);

  // Close hover preview if user selects text (bubble menu opens) or document updates.
  useEffect(() => {
    const handleSelectionUpdate = () => {
      if (!editor.state.selection.empty && modeRef.current === "preview") {
        closePopover();
      }
    };
    editor.on("selectionUpdate", handleSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor, closePopover]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseOver = (event: MouseEvent) => {
      if (editor.isDestroyed) return;
      if (modeRef.current === "edit") return;
      if (getLinkStorage(editor)?.isBubbleMenuOpen) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || !container.contains(anchor)) {
        if (openRef.current) {
          scheduleClose();
        }
        return;
      }

      const rawHref = anchor.getAttribute("href") ?? "";
      if (!rawHref || !isSafeLinkHref(rawHref)) return;

      try {
        const pos = editor.view.posAtDOM(anchor, 0);
        const range = findLinkMarkRange(editor, pos, rawHref);
        if (!range) return;

        clearCloseTimer();
        setActiveLink({
          anchor,
          from: range.from,
          to: range.to,
          url: rawHref,
          text: range.text,
        });
        setMode("preview");
        setCopied(false);
        setOpen(true);

        const storage = getLinkStorage(editor);
        if (storage) storage.isPreviewOpen = true;
      } catch {
        // Ignore transient DOM/ProseMirror reconciliation errors while hovering.
      }
    };

    const handleMouseLeave = () => {
      if (openRef.current && modeRef.current === "preview") {
        scheduleClose();
      }
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [containerRef, editor, clearCloseTimer, scheduleClose]);

  const handleCopyUrl = useCallback(async () => {
    if (!activeLink) return;
    try {
      await navigator.clipboard.writeText(activeLink.url);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, COPY_FEEDBACK_MS);
    } catch {
      // Clipboard may be unavailable in restricted contexts.
    }
  }, [activeLink]);

  const handleUnlink = useCallback(() => {
    if (!activeLink || !isEditable) return;
    const linkType = editor.state.schema.marks.link;
    if (!linkType) return;

    const docSize = editor.state.doc.content.size;
    const from = Math.max(0, Math.min(activeLink.from, docSize));
    const to = Math.max(from, Math.min(activeLink.to, docSize));
    editor.view.dispatch(editor.state.tr.removeMark(from, to, linkType));
    closePopover();
  }, [activeLink, isEditable, editor, closePopover]);

  const handleEnterEdit = useCallback(() => {
    if (!activeLink || !isEditable) return;
    clearCloseTimer();
    setEditUrl(activeLink.url);
    setEditText(activeLink.text);
    setUrlError(false);
    setMode("edit");
  }, [activeLink, isEditable, clearCloseTimer]);

  const handleSaveEdit = useCallback(() => {
    if (!activeLink || !isEditable) return;
    const normalized = normalizeLinkHref(editUrl);
    if (!normalized) {
      setUrlError(true);
      return;
    }

    const applied = updateLinkRange(
      editor,
      { from: activeLink.from, to: activeLink.to },
      normalized,
      editText,
    );
    if (!applied) {
      setUrlError(true);
      return;
    }

    closePopover();
  }, [activeLink, isEditable, editor, editUrl, editText, closePopover]);

  if (!activeLink) return null;

  const canEdit = isEditable;
  const effectiveMode: LinkPopoverMode = canEdit ? mode : "preview";

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closePopover();
        }
      }}
    >
      <PopoverContent
        anchor={activeLink.anchor}
        side="bottom"
        align="start"
        sideOffset={6}
        onMouseEnter={clearCloseTimer}
        onMouseLeave={scheduleClose}
        className="w-auto p-0"
      >
        {effectiveMode === "preview" ? (
          <div className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-muted-foreground">
            <Globe className="size-3.5 shrink-0" aria-hidden="true" />
            <a
              href={isSafeLinkHref(activeLink.url) ? activeLink.url : undefined}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="max-w-72 truncate text-foreground hover:underline"
            >
              {truncateLinkDisplay(activeLink.url, 40)}
            </a>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title={copied ? t("detail.copied") : t("editor.link.copy")}
                aria-label={copied ? t("detail.copied") : t("editor.link.copy")}
                onClick={() => void handleCopyUrl()}
                className="grid size-6 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {copied ? (
                  <Check
                    className="size-3.5 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
              </button>
              {canEdit && (
                <>
                  <button
                    type="button"
                    title={t("editor.link.edit")}
                    aria-label={t("editor.link.edit")}
                    onClick={handleEnterEdit}
                    className="grid size-6 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    title={t("editor.link.unlink")}
                    aria-label={t("editor.link.unlink")}
                    onClick={handleUnlink}
                    className="grid size-6 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                  >
                    <Unlink className="size-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div
            className="flex w-[296px] flex-col gap-2.5 p-2.5"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                handleSaveEdit();
              } else if (event.key === "Escape") {
                event.stopPropagation();
                closePopover();
              }
            }}
          >
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                {t("editor.link.urlLabel")}
              </label>
              <input
                type="url"
                autoFocus
                value={editUrl}
                placeholder={t("editor.link.urlPlaceholder")}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  setEditUrl(event.target.value);
                  setUrlError(false);
                }}
                className={cn(
                  "h-8 w-full rounded-md border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  urlError ? "border-destructive" : "border-input",
                )}
              />
              {urlError && (
                <p className="text-[11px] text-destructive">
                  {t("editor.link.invalidUrl")}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                {t("editor.link.textLabel")}
              </label>
              <input
                type="text"
                value={editText}
                placeholder={t("editor.link.textPlaceholder")}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => setEditText(event.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="h-px w-full bg-border" />

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleUnlink}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Unlink className="size-3.5" aria-hidden="true" />
                <span>{t("editor.link.remove")}</span>
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="inline-flex cursor-pointer items-center gap-1 rounded-sm bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <span>{t("editor.link.apply")}</span>
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
