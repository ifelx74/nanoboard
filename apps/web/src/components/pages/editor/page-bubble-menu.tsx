import { isNodeSelection } from "@tiptap/core";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Strikethrough,
  Trash2,
  Type,
  Underline,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isPageColorKey, type PageColorKey } from "@/lib/pages/colors";
import {
  isCellSelection,
  toggleSmartCode,
  type PageTextAlignment,
} from "@/lib/pages/editor-commands";
import type { PageLinkStorage } from "@/lib/pages/extensions/link-extension";
import { normalizeLinkHref } from "@/lib/pages/links";
import { cn } from "@/lib/utils";
import {
  PageColorPickerPanel,
  PageColorTriggerPreview,
} from "./page-color-picker-panel";

export interface PageBubbleMenuProps {
  editor: Editor;
  scrollTarget?: HTMLElement | null;
}

const BUBBLE_PLUGIN_KEY = "pagesBubbleMenu";

function getLinkStorage(editor: Editor): PageLinkStorage | undefined {
  return (editor.storage as { link?: PageLinkStorage }).link;
}

function BubbleIconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={Boolean(active)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Plane-styled floating Bubble Menu for text selections:
 * Node selector | Link popover | Color popover | Basic marks | Alignment.
 * Suppressed on empty selection, read-only mode, images, code blocks,
 * NodeSelection / CellSelection, and while actively mouse drag-selecting.
 */
export function PageBubbleMenu({ editor, scrollTarget }: PageBubbleMenuProps) {
  const { t } = useTranslation("pages");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isSelectingRef = useRef(false);
  const [isSelecting, setIsSelecting] = useState(false);

  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState("");
  const [linkError, setLinkError] = useState(false);

  const editorState = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const colorAttrs = e.getAttributes("pageColor") as {
        color?: unknown;
        backgroundColor?: unknown;
      };
      const linkAttrs = e.getAttributes("link") as { href?: string };

      let headingLevel: 1 | 2 | 3 | 4 | 5 | 6 | null = null;
      for (const level of [1, 2, 3, 4, 5, 6] as const) {
        if (e.isActive("heading", { level })) {
          headingLevel = level;
          break;
        }
      }

      return {
        headingLevel,
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        taskList: e.isActive("taskList"),
        blockquote: e.isActive("blockquote"),
        code: e.isActive("code"),
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        linkActive: e.isActive("link"),
        linkHref: linkAttrs.href ?? "",
        alignLeft: e.isActive({ textAlign: "left" }),
        alignCenter: e.isActive({ textAlign: "center" }),
        alignRight: e.isActive({ textAlign: "right" }),
        textColor: isPageColorKey(colorAttrs.color)
          ? colorAttrs.color
          : undefined,
        backgroundColor: isPageColorKey(colorAttrs.backgroundColor)
          ? colorAttrs.backgroundColor
          : undefined,
      };
    },
  });

  // Hide the bubble menu while the user is actively dragging a text selection
  // with the mouse, then immediately reposition/reveal on mouseup.
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      if (!editor.view.dom.contains(event.target as Node)) return;

      const handleMouseMove = () => {
        if (!editor.state.selection.empty && !isSelectingRef.current) {
          isSelectingRef.current = true;
          setIsSelecting(true);
        }
      };

      const handleMouseUp = () => {
        const wasSelecting = isSelectingRef.current;
        isSelectingRef.current = false;
        setIsSelecting(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        if (wasSelecting && !editor.isDestroyed) {
          editor.view.dispatch(
            editor.state.tr.setMeta(BUBBLE_PLUGIN_KEY, "updatePosition"),
          );
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [editor]);

  const handleLinkPopoverOpenChange = useCallback(
    (open: boolean) => {
      setLinkPopoverOpen(open);
      setLinkError(false);
      if (open) {
        const currentHref =
          (editor.getAttributes("link") as { href?: string }).href ?? "";
        setLinkUrlInput(currentHref);
      }
    },
    [editor],
  );

  const handleApplyLink = useCallback(() => {
    const trimmed = linkUrlInput.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkPopoverOpen(false);
      setLinkError(false);
      return;
    }

    const normalized = normalizeLinkHref(trimmed);
    if (!normalized) {
      setLinkError(true);
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: normalized })
      .run();
    setLinkPopoverOpen(false);
    setLinkError(false);
  }, [editor, linkUrlInput]);

  const nodeItems = [
    {
      key: "text",
      label: t("editor.blocks.text"),
      icon: Type,
      active:
        editorState.headingLevel === null &&
        !editorState.bulletList &&
        !editorState.orderedList &&
        !editorState.taskList &&
        !editorState.blockquote &&
        !editorState.code,
      run: () => editor.chain().focus().setParagraph().run(),
    },
    {
      key: "h1",
      label: t("editor.blocks.h1"),
      icon: Heading1,
      active: editorState.headingLevel === 1,
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      key: "h2",
      label: t("editor.blocks.h2"),
      icon: Heading2,
      active: editorState.headingLevel === 2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      key: "h3",
      label: t("editor.blocks.h3"),
      icon: Heading3,
      active: editorState.headingLevel === 3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      key: "h4",
      label: t("editor.blocks.h4"),
      icon: Heading4,
      active: editorState.headingLevel === 4,
      run: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
    },
    {
      key: "h5",
      label: t("editor.blocks.h5"),
      icon: Heading5,
      active: editorState.headingLevel === 5,
      run: () => editor.chain().focus().toggleHeading({ level: 5 }).run(),
    },
    {
      key: "h6",
      label: t("editor.blocks.h6"),
      icon: Heading6,
      active: editorState.headingLevel === 6,
      run: () => editor.chain().focus().toggleHeading({ level: 6 }).run(),
    },
    {
      key: "bulletList",
      label: t("editor.blocks.bulletList"),
      icon: List,
      active: editorState.bulletList,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: "orderedList",
      label: t("editor.blocks.orderedList"),
      icon: ListOrdered,
      active: editorState.orderedList,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      key: "taskList",
      label: t("editor.blocks.taskList"),
      icon: ListTodo,
      active: editorState.taskList,
      run: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      key: "quote",
      label: t("editor.blocks.quote"),
      icon: Quote,
      active: editorState.blockquote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      key: "code",
      label: t("editor.blocks.code"),
      icon: Code,
      active: editorState.code,
      run: () => toggleSmartCode(editor),
    },
  ];

  const activeNodeItem = nodeItems.filter((item) => item.active).pop() ?? {
    key: "multiple",
    label: t("editor.bubble.multiple"),
  };

  const setAlignment = (alignment: PageTextAlignment) => {
    editor.chain().focus().setTextAlign(alignment).run();
  };

  const iconClass = "size-3.5";

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={BUBBLE_PLUGIN_KEY}
      updateDelay={120}
      shouldShow={({ editor: e, state }) => {
        const { selection } = state;
        if (
          selection.empty ||
          !e.isEditable ||
          isSelectingRef.current ||
          isNodeSelection(selection) ||
          isCellSelection(selection) ||
          e.isActive("image") ||
          e.isActive("pageImage") ||
          e.isActive("codeBlock")
        ) {
          return false;
        }
        return true;
      }}
      options={{
        placement: "top",
        offset: 8,
        flip: true,
        shift: { padding: 8 },
        scrollTarget: scrollTarget ?? undefined,
        onShow: () => {
          const storage = getLinkStorage(editor);
          if (storage) storage.isBubbleMenuOpen = true;
        },
        onHide: () => {
          const storage = getLinkStorage(editor);
          if (storage) storage.isBubbleMenuOpen = false;
          setLinkPopoverOpen(false);
          setLinkError(false);
        },
      }}
    >
      {!isSelecting && (
        <div
          ref={menuRef}
          role="toolbar"
          aria-label={t("editor.bubble.ariaLabel")}
          className="flex max-w-[92vw] items-center divide-x divide-border overflow-x-auto rounded-lg border border-border bg-popover py-1.5 text-popover-foreground shadow-md"
        >
          {/* 1. Node selector */}
          <div className="px-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={t("editor.bubble.nodeType")}
                    onMouseDown={(event) => event.preventDefault()}
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground data-popup-open:bg-accent data-popup-open:text-foreground"
                  >
                    <span>{activeNodeItem.label}</span>
                    <ChevronDown
                      className="size-3 shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                }
              />
              <DropdownMenuContent
                align="start"
                side="bottom"
                className="max-h-72 w-48"
              >
                {nodeItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.key}
                      onClick={item.run}
                      className="justify-between text-xs"
                    >
                      <span className="flex items-center gap-2">
                        <Icon
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span>{item.label}</span>
                      </span>
                      {item.active && (
                        <Check
                          className="size-3.5 text-brand-800"
                          aria-hidden="true"
                        />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* 2. Link popover (hidden inside inline code) */}
          {!editorState.code && (
            <div className="px-1.5">
              <Popover
                open={linkPopoverOpen}
                onOpenChange={handleLinkPopoverOpenChange}
              >
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label={t("editor.link.trigger")}
                      aria-pressed={editorState.linkActive}
                      onMouseDown={(event) => event.preventDefault()}
                      className={cn(
                        "inline-flex h-7 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground data-popup-open:bg-accent",
                        editorState.linkActive && "text-foreground",
                      )}
                    >
                      <span>{t("editor.link.trigger")}</span>
                      <Link2 className="size-3 shrink-0" aria-hidden="true" />
                    </button>
                  }
                />
                <PopoverContent
                  align="start"
                  side="bottom"
                  className="w-64 p-1.5"
                >
                  <div
                    className={cn(
                      "flex items-center overflow-hidden rounded-sm border bg-background transition-colors",
                      linkError ? "border-destructive" : "border-input",
                    )}
                  >
                    <input
                      type="url"
                      autoFocus
                      value={linkUrlInput}
                      aria-label={t("editor.link.urlLabel")}
                      placeholder={t("editor.link.urlPlaceholder")}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        setLinkUrlInput(event.target.value);
                        setLinkError(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.stopPropagation();
                          handleApplyLink();
                        } else if (event.key === "Escape") {
                          event.stopPropagation();
                          setLinkPopoverOpen(false);
                        }
                      }}
                      className="h-7 min-w-0 flex-1 bg-transparent px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      aria-label={t("editor.link.apply")}
                      title={t("editor.link.apply")}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleApplyLink();
                      }}
                      className="grid size-7 shrink-0 cursor-pointer place-items-center border-l border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                    </button>
                    {editorState.linkHref && (
                      <button
                        type="button"
                        aria-label={t("editor.link.remove")}
                        title={t("editor.link.remove")}
                        onClick={(event) => {
                          event.stopPropagation();
                          editor
                            .chain()
                            .focus()
                            .extendMarkRange("link")
                            .unsetLink()
                            .run();
                          setLinkPopoverOpen(false);
                        }}
                        className="grid size-7 shrink-0 cursor-pointer place-items-center border-l border-border text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {linkError && (
                    <p className="mt-1 px-1 text-[11px] text-destructive">
                      {t("editor.link.invalidUrl")}
                    </p>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* 3. Color popover (hidden inside inline code) */}
          {!editorState.code && (
            <div className="px-1.5">
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      aria-label={t("editor.colors.trigger")}
                      onMouseDown={(event) => event.preventDefault()}
                      className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground data-popup-open:bg-accent"
                    >
                      <span>{t("editor.colors.trigger")}</span>
                      <PageColorTriggerPreview
                        activeTextColor={editorState.textColor}
                        activeBackgroundColor={editorState.backgroundColor}
                      />
                    </button>
                  }
                />
                <PopoverContent
                  align="start"
                  side="bottom"
                  className="w-auto p-0"
                >
                  <PageColorPickerPanel
                    activeTextColor={editorState.textColor}
                    activeBackgroundColor={editorState.backgroundColor}
                    onSelectTextColor={(color: PageColorKey | undefined) => {
                      if (color) {
                        editor.chain().focus().setTextColor(color).run();
                      } else {
                        editor.chain().focus().unsetTextColor().run();
                      }
                    }}
                    onSelectBackgroundColor={(
                      color: PageColorKey | undefined,
                    ) => {
                      if (color) {
                        editor.chain().focus().setBackgroundColor(color).run();
                      } else {
                        editor.chain().focus().unsetBackgroundColor().run();
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* 4. Basic marks (or inline code toggle when cursor is in inline code) */}
          <div className="flex items-center gap-0.5 px-1.5">
            {editorState.code ? (
              <BubbleIconButton
                label={t("editor.marks.inlineCode")}
                active={editorState.code}
                onClick={() => editor.chain().focus().toggleCode().run()}
              >
                <Code className={iconClass} aria-hidden="true" />
              </BubbleIconButton>
            ) : (
              <>
                <BubbleIconButton
                  label={t("editor.marks.bold")}
                  active={editorState.bold}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Bold className={iconClass} aria-hidden="true" />
                </BubbleIconButton>
                <BubbleIconButton
                  label={t("editor.marks.italic")}
                  active={editorState.italic}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Italic className={iconClass} aria-hidden="true" />
                </BubbleIconButton>
                <BubbleIconButton
                  label={t("editor.marks.underline")}
                  active={editorState.underline}
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                  <Underline className={iconClass} aria-hidden="true" />
                </BubbleIconButton>
                <BubbleIconButton
                  label={t("editor.marks.strikethrough")}
                  active={editorState.strike}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                >
                  <Strikethrough className={iconClass} aria-hidden="true" />
                </BubbleIconButton>
              </>
            )}
          </div>

          {/* 5. Alignment toggles */}
          <div className="flex items-center gap-0.5 px-1.5">
            <BubbleIconButton
              label={t("editor.align.left")}
              active={editorState.alignLeft}
              onClick={() => setAlignment("left")}
            >
              <AlignLeft className={iconClass} aria-hidden="true" />
            </BubbleIconButton>
            <BubbleIconButton
              label={t("editor.align.center")}
              active={editorState.alignCenter}
              onClick={() => setAlignment("center")}
            >
              <AlignCenter className={iconClass} aria-hidden="true" />
            </BubbleIconButton>
            <BubbleIconButton
              label={t("editor.align.right")}
              active={editorState.alignRight}
              onClick={() => setAlignment("right")}
            >
              <AlignRight className={iconClass} aria-hidden="true" />
            </BubbleIconButton>
          </div>
        </div>
      )}
    </BubbleMenu>
  );
}
