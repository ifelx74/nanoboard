import { Extension, type Editor, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Type,
} from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { i18n } from "@/lib/i18n";
import { PAGE_COLORS } from "@/lib/pages/colors";
import { toggleSmartCode } from "@/lib/pages/editor-commands";
import {
  filterSlashCommandSections,
  getNextSlashCommandIndex,
  mergeAdditionalSlashItems,
  splitHighlightMatch,
  type SlashCommandAdditionalEntry,
  type SlashCommandItemBase,
  type SlashCommandSection,
  type SlashCommandSelectionIndex,
} from "@/lib/pages/slash-commands";
import { cn } from "@/lib/utils";
import { getPageColorLabel } from "./page-color-picker-panel";

export interface PageSlashCommandItem extends SlashCommandItemBase {
  icon: ReactNode;
  iconContainerStyle?: CSSProperties;
  command: (context: { editor: Editor; range: Range }) => void;
}

export type PageSlashCommandSection = SlashCommandSection<PageSlashCommandItem>;
export type PageSlashCommandAdditionalEntry =
  SlashCommandAdditionalEntry<PageSlashCommandItem>;

export interface PageSlashCommandOptions {
  additionalItems?: readonly PageSlashCommandAdditionalEntry[];
  disabledKeys?: readonly string[];
}

function buildBaseSlashSections(): PageSlashCommandSection[] {
  const iconClass = "size-3.5";

  return [
    {
      key: "general",
      items: [
        {
          key: "text",
          commandKey: "text",
          title: i18n.t("pages:editor.blocks.text"),
          description: i18n.t("pages:editor.slash.textDesc"),
          searchTerms: ["p", "paragraph", "text", "plain"],
          icon: <Type className={iconClass} aria-hidden="true" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setParagraph().run();
          },
        },
        {
          key: "h1",
          commandKey: "h1",
          title: i18n.t("pages:editor.blocks.h1"),
          description: i18n.t("pages:editor.slash.h1Desc"),
          searchTerms: ["h1", "heading", "title", "big", "large"],
          icon: <Heading1 className={iconClass} aria-hidden="true" />,
          command: ({ editor, range }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .setNode("heading", { level: 1 })
              .run();
          },
        },
        {
          key: "h2",
          commandKey: "h2",
          title: i18n.t("pages:editor.blocks.h2"),
          description: i18n.t("pages:editor.slash.h2Desc"),
          searchTerms: ["h2", "heading", "subtitle", "medium"],
          icon: <Heading2 className={iconClass} aria-hidden="true" />,
          command: ({ editor, range }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .setNode("heading", { level: 2 })
              .run();
          },
        },
        {
          key: "h3",
          commandKey: "h3",
          title: i18n.t("pages:editor.blocks.h3"),
          description: i18n.t("pages:editor.slash.h3Desc"),
          searchTerms: ["h3", "heading", "subtitle", "small"],
          icon: <Heading3 className={iconClass} aria-hidden="true" />,
          command: ({ editor, range }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .setNode("heading", { level: 3 })
              .run();
          },
        },
        {
          key: "h4",
          commandKey: "h4",
          title: i18n.t("pages:editor.blocks.h4"),
          description: i18n.t("pages:editor.slash.h4Desc"),
          searchTerms: ["h4", "heading", "subtitle", "small"],
          icon: <Heading4 className={iconClass} aria-hidden="true" />,
          command: ({ editor, range }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .setNode("heading", { level: 4 })
              .run();
          },
        },
        {
          key: "h5",
          commandKey: "h5",
          title: i18n.t("pages:editor.blocks.h5"),
          description: i18n.t("pages:editor.slash.h5Desc"),
          searchTerms: ["h5", "heading", "subtitle", "small"],
          icon: <Heading5 className={iconClass} aria-hidden="true" />,
          command: ({ editor, range }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .setNode("heading", { level: 5 })
              .run();
          },
        },
        {
          key: "h6",
          commandKey: "h6",
          title: i18n.t("pages:editor.blocks.h6"),
          description: i18n.t("pages:editor.slash.h6Desc"),
          searchTerms: ["h6", "heading", "subtitle", "small"],
          icon: <Heading6 className={iconClass} aria-hidden="true" />,
          command: ({ editor, range }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .setNode("heading", { level: 6 })
              .run();
          },
        },
        {
          key: "numbered-list",
          commandKey: "numbered-list",
          title: i18n.t("pages:editor.blocks.orderedList"),
          description: i18n.t("pages:editor.slash.orderedListDesc"),
          searchTerms: ["ol", "ordered", "numbered", "list"],
          icon: <ListOrdered className={iconClass} aria-hidden="true" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleOrderedList().run();
          },
        },
        {
          key: "bulleted-list",
          commandKey: "bulleted-list",
          title: i18n.t("pages:editor.blocks.bulletList"),
          description: i18n.t("pages:editor.slash.bulletListDesc"),
          searchTerms: ["ul", "unordered", "bullet", "list", "point"],
          icon: <List className={iconClass} aria-hidden="true" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBulletList().run();
          },
        },
        {
          key: "to-do-list",
          commandKey: "to-do-list",
          title: i18n.t("pages:editor.blocks.taskList"),
          description: i18n.t("pages:editor.slash.taskListDesc"),
          searchTerms: ["todo", "task", "list", "check", "checkbox"],
          icon: <ListTodo className={iconClass} aria-hidden="true" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleTaskList().run();
          },
        },
        {
          key: "quote",
          commandKey: "quote",
          title: i18n.t("pages:editor.blocks.quote"),
          description: i18n.t("pages:editor.slash.quoteDesc"),
          searchTerms: ["blockquote", "quote", "citation"],
          icon: <Quote className={iconClass} aria-hidden="true" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBlockquote().run();
          },
        },
        {
          key: "code",
          commandKey: "code",
          title: i18n.t("pages:editor.blocks.code"),
          description: i18n.t("pages:editor.slash.codeDesc"),
          searchTerms: ["code", "codeblock", "snippet", "pre"],
          icon: <Code className={iconClass} aria-hidden="true" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).run();
            toggleSmartCode(editor);
          },
        },
        {
          key: "divider",
          commandKey: "divider",
          title: i18n.t("pages:editor.blocks.divider"),
          description: i18n.t("pages:editor.slash.dividerDesc"),
          searchTerms: ["line", "divider", "hr", "horizontal", "rule"],
          icon: <Minus className={iconClass} aria-hidden="true" />,
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setHorizontalRule().run();
          },
        },
      ],
    },
    {
      key: "text-colors",
      title: i18n.t("pages:editor.slash.colorsSection"),
      items: [
        {
          key: "text-color-default",
          commandKey: "text-color",
          title: i18n.t("pages:editor.colors.default"),
          description: i18n.t("pages:editor.slash.textColorDesc"),
          searchTerms: ["color", "text", "default", "reset"],
          icon: (
            <span className="text-xs font-semibold text-foreground">A</span>
          ),
          command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).unsetTextColor().run();
          },
        },
        ...PAGE_COLORS.map((color): PageSlashCommandItem => {
          const label = getPageColorLabel(color.key);
          return {
            key: `text-color-${color.key}`,
            commandKey: "text-color",
            title: label,
            description: i18n.t("pages:editor.slash.textColorDesc"),
            searchTerms: ["color", "text", color.key, label],
            icon: (
              <span
                className="text-xs font-semibold"
                style={{ color: color.textVar }}
              >
                A
              </span>
            ),
            command: ({ editor, range }) => {
              editor
                .chain()
                .focus()
                .deleteRange(range)
                .setTextColor(color.key)
                .run();
            },
          };
        }),
      ],
    },
    {
      key: "background-colors",
      title: i18n.t("pages:editor.slash.backgroundColorsSection"),
      items: [
        {
          key: "background-color-default",
          commandKey: "background-color",
          title: i18n.t("pages:editor.colors.defaultBackground"),
          description: i18n.t("pages:editor.slash.backgroundColorDesc"),
          searchTerms: ["color", "bg", "background", "highlight", "default"],
          icon: (
            <span className="text-[11px] font-semibold text-foreground">A</span>
          ),
          iconContainerStyle: {
            borderRadius: "4px",
            backgroundColor: "var(--background)",
            border: "1px solid var(--border)",
          },
          command: ({ editor, range }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .unsetBackgroundColor()
              .run();
          },
        },
        ...PAGE_COLORS.map((color): PageSlashCommandItem => {
          const label = getPageColorLabel(color.key);
          return {
            key: `background-color-${color.key}`,
            commandKey: "background-color",
            title: label,
            description: i18n.t("pages:editor.slash.backgroundColorDesc"),
            searchTerms: [
              "color",
              "bg",
              "background",
              "highlight",
              color.key,
              label,
            ],
            icon: (
              <span className="text-[11px] font-semibold text-foreground">
                A
              </span>
            ),
            iconContainerStyle: {
              borderRadius: "4px",
              backgroundColor: color.backgroundVar,
            },
            command: ({ editor, range }) => {
              editor
                .chain()
                .focus()
                .deleteRange(range)
                .setBackgroundColor(color.key)
                .run();
            },
          };
        }),
      ],
    },
  ];
}

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  const parts = splitHighlightMatch(title, query);
  if (!parts) return <>{title}</>;
  return (
    <>
      {parts.before}
      <span className="font-semibold text-foreground">{parts.match}</span>
      {parts.after}
    </>
  );
}

interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SlashMenuProps {
  items: PageSlashCommandSection[];
  query: string;
  command: (item: PageSlashCommandItem) => void;
  clientRect?: (() => DOMRect | null) | null;
  onDismiss: () => void;
}

const MENU_MAX_HEIGHT = 320;
const MENU_MIN_WIDTH = 216;
const VIEWPORT_PADDING = 12;

const PageSlashCommandMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(
  function PageSlashCommandMenu(
    { items: sections, query, command, clientRect, onDismiss },
    ref,
  ) {
    const [selected, setSelected] = useState<SlashCommandSelectionIndex>({
      section: 0,
      item: 0,
    });
    const [position, setPosition] = useState<{
      top: number;
      left: number;
    } | null>(null);
    const listRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      setSelected({ section: 0, item: 0 });
    }, [sections]);

    const selectCurrent = useCallback(
      (sectionIdx: number, itemIdx: number) => {
        const target = sections[sectionIdx]?.items[itemIdx];
        if (target) {
          command(target);
        }
      },
      [command, sections],
    );

    useLayoutEffect(() => {
      const rect = clientRect?.();
      if (!rect) {
        setPosition(null);
        return;
      }

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const menuHeight = listRef.current?.offsetHeight ?? MENU_MAX_HEIGHT;
      const menuWidth = listRef.current?.offsetWidth ?? MENU_MIN_WIDTH;

      const fitsBelow =
        rect.bottom + 6 + Math.min(menuHeight, MENU_MAX_HEIGHT) <=
        viewportHeight - VIEWPORT_PADDING;
      const rawTop = fitsBelow
        ? rect.bottom + 6
        : Math.max(
            VIEWPORT_PADDING,
            rect.top - Math.min(menuHeight, MENU_MAX_HEIGHT) - 6,
          );
      const rawLeft = Math.min(
        Math.max(VIEWPORT_PADDING, rect.left),
        Math.max(
          VIEWPORT_PADDING,
          viewportWidth - menuWidth - VIEWPORT_PADDING,
        ),
      );

      setPosition({ top: rawTop, left: rawLeft });
    }, [clientRect, sections]);

    useLayoutEffect(() => {
      const container = listRef.current;
      if (!container) return;
      const activeEl = container.querySelector<HTMLElement>(
        `[data-slash-index="${selected.section}-${selected.item}"]`,
      );
      activeEl?.scrollIntoView({ block: "nearest" });
    }, [selected, sections]);

    useEffect(() => {
      const handlePointerDown = (event: MouseEvent) => {
        if (
          listRef.current &&
          !listRef.current.contains(event.target as Node)
        ) {
          onDismiss();
        }
      };
      document.addEventListener("mousedown", handlePointerDown);
      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
      };
    }, [onDismiss]);

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown(event: KeyboardEvent) {
          if (event.key === "Escape") {
            onDismiss();
            return true;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            const next = getNextSlashCommandIndex(
              sections,
              selected,
              event.key === "ArrowDown" ? "down" : "up",
            );
            if (next) {
              setSelected(next);
            }
            return true;
          }
          if (event.key === "Enter") {
            selectCurrent(selected.section, selected.item);
            return true;
          }
          return false;
        },
      }),
      [onDismiss, sections, selectCurrent, selected],
    );

    if (sections.length === 0 || !position) return null;

    return (
      <div
        ref={listRef}
        role="listbox"
        aria-label={i18n.t("pages:editor.slash.ariaLabel")}
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          zIndex: 100,
        }}
        className="max-h-80 min-w-[13.5rem] space-y-2 overflow-y-auto rounded-md border border-border bg-popover px-2 py-2.5 text-popover-foreground shadow-md"
      >
        {sections.map((section, sectionIndex) => (
          <div key={section.key} className="space-y-1">
            {section.title && (
              <div className="px-1 text-[11px] font-semibold text-muted-foreground">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item, itemIndex) => {
                const isSelected =
                  sectionIndex === selected.section &&
                  itemIndex === selected.item;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-slash-index={`${sectionIndex}-${itemIndex}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectCurrent(sectionIndex, itemIndex);
                    }}
                    onMouseEnter={() =>
                      setSelected({ section: sectionIndex, item: itemIndex })
                    }
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 truncate rounded-sm px-1.5 py-1.5 text-left text-xs text-muted-foreground transition-colors",
                      isSelected
                        ? "bg-accent text-foreground"
                        : "hover:bg-accent/70",
                    )}
                  >
                    <span
                      className="grid size-5 shrink-0 place-items-center text-muted-foreground"
                      style={item.iconContainerStyle}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <HighlightedTitle title={item.title} query={query} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  },
);

/**
 * Plane-styled `/` Slash Command TipTap v3 extension with `General`, `Colors`,
 * and `Background colors` sections, match highlighting, and suppression inside
 * code blocks or read-only mode. Supports downstream item injection via
 * `additionalItems`.
 */
export function createPageSlashCommandExtension(
  options: PageSlashCommandOptions = {},
) {
  return Extension.create({
    name: "pagesSlashCommands",

    addProseMirrorPlugins() {
      return [
        Suggestion<PageSlashCommandSection, PageSlashCommandItem>({
          editor: this.editor,
          char: "/",
          allow: ({ editor }) => {
            if (!editor.isEditable) return false;
            const { selection } = editor.state;
            const parentType = selection.$from.parent.type.name;
            if (parentType === "codeBlock") return false;
            return true;
          },
          items: ({ query }) => {
            const merged = mergeAdditionalSlashItems(
              buildBaseSlashSections(),
              options.additionalItems,
              options.disabledKeys,
            );
            return filterSlashCommandSections(merged, query);
          },
          command: ({ editor, range, props }) => {
            props.command({ editor, range });
          },
          render: () => {
            let renderer: ReactRenderer<
              SlashMenuHandle,
              SlashMenuProps
            > | null = null;

            const destroy = () => {
              renderer?.destroy();
              renderer = null;
            };

            return {
              onStart: (
                props: SuggestionProps<
                  PageSlashCommandSection,
                  PageSlashCommandItem
                >,
              ) => {
                renderer = new ReactRenderer(PageSlashCommandMenu, {
                  props: {
                    items: props.items,
                    query: props.query,
                    command: props.command,
                    clientRect: props.clientRect,
                    onDismiss: destroy,
                  },
                  editor: props.editor,
                });
              },
              onUpdate: (
                props: SuggestionProps<
                  PageSlashCommandSection,
                  PageSlashCommandItem
                >,
              ) => {
                renderer?.updateProps({
                  items: props.items,
                  query: props.query,
                  command: props.command,
                  clientRect: props.clientRect,
                  onDismiss: destroy,
                });
              },
              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (!renderer) return false;
                if (props.event.key === "Escape") {
                  destroy();
                  return true;
                }
                return renderer.ref?.onKeyDown(props.event) ?? false;
              },
              onExit: () => {
                destroy();
              },
            };
          },
        }),
      ];
    },
  });
}
