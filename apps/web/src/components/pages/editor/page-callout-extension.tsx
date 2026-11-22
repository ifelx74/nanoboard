import { mergeAttributes, Node } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { Ban, ChevronDown } from "lucide-react";
import { useEffect, useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { PageLogoIcon } from "@/components/pages/page-logo";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PageLogo } from "@/lib/db/schema";
import {
  buildInitialCalloutAttrs,
  calloutAttrsToLogo,
  DEFAULT_CALLOUT_EMOJI,
  logoToCalloutAttrs,
  writeCalloutBackgroundColorPref,
  writeCalloutLogoPref,
  type CalloutNodeAttrs,
} from "@/lib/pages/callout-prefs";
import {
  getPageBackgroundColorVar,
  isPageColorKey,
  PAGE_COLORS,
  type PageColorKey,
} from "@/lib/pages/colors";
import { isValidEmojiValue, isValidHexColor } from "@/lib/pages/logo";
import { isProjectIconKey } from "@/lib/project-icons";
import { cn } from "@/lib/utils";
import { getPageColorLabel } from "./page-color-picker-panel";
import { usePageEditorEditable } from "./page-editor-context";
import { PageEmojiIconPicker } from "./page-emoji-icon-picker";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      insertCallout: (attrs?: Partial<CalloutNodeAttrs>) => ReturnType;
    };
  }
}

function stopPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

function PageCalloutNodeView({
  editor,
  node,
  updateAttributes,
}: NodeViewProps) {
  const { t } = useTranslation("pages");
  const isEditable = usePageEditorEditable(editor);
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  useEffect(() => {
    if (!isEditable) {
      setLogoPickerOpen(false);
      setColorPickerOpen(false);
    }
  }, [isEditable]);

  const attrs = node.attrs as Partial<CalloutNodeAttrs>;
  const logo = calloutAttrsToLogo(attrs);
  const backgroundColor = isPageColorKey(attrs.backgroundColor)
    ? attrs.backgroundColor
    : null;

  function handleLogoSelect(nextLogo: PageLogo) {
    updateAttributes(logoToCalloutAttrs(nextLogo));
    writeCalloutLogoPref(nextLogo);
  }

  function handleBackgroundSelect(nextColor: PageColorKey | null) {
    updateAttributes({ backgroundColor: nextColor });
    writeCalloutBackgroundColorPref(nextColor);
    setColorPickerOpen(false);
  }

  return (
    <NodeViewWrapper
      data-type="callout"
      data-callout-background={backgroundColor ?? undefined}
      className="nb-callout-node group/callout-node relative my-2 flex items-start gap-3 rounded-lg border border-border/60 bg-muted/60 p-4 break-words text-foreground transition-colors duration-300"
      style={
        backgroundColor
          ? { backgroundColor: getPageBackgroundColorVar(backgroundColor) }
          : undefined
      }
    >
      {/* Left 32×32 callout icon/emoji selector */}
      <div contentEditable={false} className="shrink-0 select-none">
        {isEditable ? (
          <PageEmojiIconPicker
            value={logo}
            open={logoPickerOpen}
            onOpenChange={setLogoPickerOpen}
            onChange={handleLogoSelect}
            trigger={
              <button
                type="button"
                aria-label={t("callout.changeIcon")}
                className={cn(
                  "grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg transition-colors outline-none hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring",
                  logoPickerOpen && "bg-background/70",
                )}
              >
                <PageLogoIcon
                  logo={logo}
                  className="size-[18px]"
                  emojiClassName="size-[18px] text-[18px] leading-none"
                />
              </button>
            }
          />
        ) : (
          <div className="grid size-8 shrink-0 place-items-center rounded-lg">
            <PageLogoIcon
              logo={logo}
              className="size-[18px]"
              emojiClassName="size-[18px] text-[18px] leading-none"
            />
          </div>
        )}
      </div>

      {/* Hover top-right 8-color semantic background picker (hidden when read-only) */}
      {isEditable && (
        <div
          contentEditable={false}
          className={cn(
            "absolute top-2 right-2 z-10 transition-opacity duration-150 select-none",
            colorPickerOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0 group-focus-within/callout-node:pointer-events-auto group-focus-within/callout-node:opacity-100 group-hover/callout-node:pointer-events-auto group-hover/callout-node:opacity-100",
          )}
        >
          <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={t("callout.colorAriaLabel")}
                  onMouseDown={stopPropagation}
                  onClick={stopPropagation}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 rounded-sm bg-background/75 px-2 py-1 text-xs font-medium text-muted-foreground shadow-2xs backdrop-blur-xs transition-colors outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    colorPickerOpen && "bg-background text-foreground",
                  )}
                >
                  <span>{t("callout.colorButton")}</span>
                  <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
                </button>
              }
            />
            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={4}
              className="w-auto p-2"
              onMouseDown={stopPropagation}
              onClick={stopPropagation}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setColorPickerOpen(false);
                  return;
                }
                if (event.key !== "Tab") {
                  event.stopPropagation();
                }
              }}
            >
              <div
                role="group"
                aria-label={t("callout.colorAriaLabel")}
                className="flex items-center gap-1.5"
              >
                {PAGE_COLORS.map((color) => {
                  const label = getPageColorLabel(color.key);
                  const active = backgroundColor === color.key;
                  return (
                    <button
                      key={color.key}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={active}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleBackgroundSelect(color.key)}
                      className={cn(
                        "size-6 shrink-0 cursor-pointer rounded-sm border border-border/80 transition-opacity hover:opacity-75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        active &&
                          "ring-2 ring-brand-800 ring-offset-1 ring-offset-popover",
                      )}
                      style={{ backgroundColor: color.backgroundVar }}
                    />
                  );
                })}
                <button
                  type="button"
                  title={t("callout.resetColor")}
                  aria-label={t("callout.resetColor")}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleBackgroundSelect(null)}
                  className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-sm border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Ban className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Nested block content */}
      <NodeViewContent className="nb-callout-content min-w-0 flex-1 break-words" />
    </NodeViewWrapper>
  );
}

/**
 * Plane-styled Callout TipTap v3 node (`type: "callout"`, `content: "block+"`).
 *
 * Schema contract (consumed by Markdown export and demo workspace seeding):
 * - `type`: `"callout"`
 * - `attrs.id`: assigned via `UniqueID` (`extraUniqueIdTypes: ["callout"]`)
 * - `attrs.logoType`: `"emoji" | "icon"` (default `"emoji"`)
 * - `attrs.emoji`: Unicode emoji string (default `"💡"`)
 * - `attrs.iconName`: `ProjectIconKey | null` (default `null`)
 * - `attrs.iconColor`: `#RGB`/`#RRGGBB` hex string or `null` (default `null`)
 * - `attrs.backgroundColor`: `PageColorKey | null` (default `null`)
 */
export const PageCalloutExtension = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      logoType: {
        default: "emoji",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-logo-type") === "icon" ? "icon" : "emoji",
        renderHTML: (attributes: { logoType?: unknown }) => ({
          "data-logo-type": attributes.logoType === "icon" ? "icon" : "emoji",
        }),
      },
      emoji: {
        default: DEFAULT_CALLOUT_EMOJI,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-emoji");
          return isValidEmojiValue(raw) ? raw : DEFAULT_CALLOUT_EMOJI;
        },
        renderHTML: (attributes: { emoji?: unknown }) => ({
          "data-emoji": isValidEmojiValue(attributes.emoji)
            ? attributes.emoji
            : DEFAULT_CALLOUT_EMOJI,
        }),
      },
      iconName: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-icon-name");
          return typeof raw === "string" && isProjectIconKey(raw) ? raw : null;
        },
        renderHTML: (attributes: { iconName?: unknown }) => {
          if (
            typeof attributes.iconName !== "string" ||
            !isProjectIconKey(attributes.iconName)
          ) {
            return {};
          }
          return { "data-icon-name": attributes.iconName };
        },
      },
      iconColor: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-icon-color");
          return isValidHexColor(raw) ? raw : null;
        },
        renderHTML: (attributes: { iconColor?: unknown }) => {
          if (!isValidHexColor(attributes.iconColor)) {
            return {};
          }
          return { "data-icon-color": attributes.iconColor };
        },
      },
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw =
            element.getAttribute("data-callout-background") ??
            element.getAttribute("data-background-color");
          return isPageColorKey(raw) ? raw : null;
        },
        renderHTML: (attributes: { backgroundColor?: unknown }) => {
          if (!isPageColorKey(attributes.backgroundColor)) {
            return {};
          }
          return { "data-callout-background": attributes.backgroundColor };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout" }),
      0,
    ];
  },

  addCommands() {
    return {
      insertCallout:
        (attrs?: Partial<CalloutNodeAttrs>) =>
        ({ commands }) => {
          const initialAttrs: CalloutNodeAttrs = {
            ...buildInitialCalloutAttrs(),
            ...attrs,
          };
          return commands.insertContent({
            type: this.name,
            attrs: initialAttrs,
            content: [{ type: "paragraph" }],
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        if (!selection.empty) return false;
        const { $from } = selection;
        if ($from.parentOffset !== 0) return false;

        for (let depth = $from.depth; depth > 0; depth -= 1) {
          const ancestor = $from.node(depth);
          if (ancestor.type.name !== this.name) continue;
          if ($from.index(depth) !== 0) return false;

          // Unwrap an empty single-paragraph callout cleanly back to a paragraph.
          if (
            ancestor.childCount === 1 &&
            ancestor.firstChild?.type.name === "paragraph" &&
            ancestor.firstChild.content.size === 0
          ) {
            return editor.commands.lift(this.name);
          }

          // If non-empty and there is content before the callout, move caret
          // out above the callout instead of destroying the block accidentally.
          const calloutPos = $from.before(depth);
          if (calloutPos > 0) {
            return editor.commands.setTextSelection(calloutPos - 1);
          }
          return false;
        }
        return false;
      },
      "Mod-Enter": ({ editor }) => {
        const { $from } = editor.state.selection;
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          if ($from.node(depth).type.name === this.name) {
            const afterPos = $from.after(depth);
            return editor
              .chain()
              .insertContentAt(afterPos, { type: "paragraph" })
              .focus(afterPos + 1)
              .run();
          }
        }
        return false;
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageCalloutNodeView);
  },
});
