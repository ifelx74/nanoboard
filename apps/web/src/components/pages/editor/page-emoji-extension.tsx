import type { Editor, Range } from "@tiptap/core";
import Emoji from "@tiptap/extension-emoji";
import { ReactRenderer } from "@tiptap/react";
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { i18n } from "@/lib/i18n";
import {
  LOCAL_PAGE_EMOJIS,
  searchLocalEmojis,
  type LocalEmojiItem,
} from "@/lib/pages/emoji-data";
import { cn } from "@/lib/utils";

const MAX_INLINE_SUGGESTIONS = 15;
const MENU_MAX_HEIGHT = 280;
const MENU_MIN_WIDTH = 224;
const VIEWPORT_PADDING = 12;

/**
 * Tracks editors where `/emoji` explicitly requested the inline `:` popup
 * immediately on an empty query (whereas typing a bare `:` in prose waits for
 * at least 1 search character so normal colons like `"Note: "` stay unobtrusive).
 */
const forceOpenEmojiEditors = new WeakSet<Editor>();

/**
 * Deletes the active slash-command range (if supplied), marks the editor to
 * reveal suggestions on an empty query, and inserts `:` to trigger inline
 * `@tiptap/extension-emoji` autocomplete.
 */
export function openInlineEmojiSuggestion(editor: Editor, range?: Range): void {
  if (!editor.isEditable) return;
  if (range) {
    editor.chain().focus().deleteRange(range).run();
  }
  forceOpenEmojiEditors.add(editor);
  editor.chain().focus().insertContent(":").run();
}

interface EmojiSuggestionMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface EmojiSuggestionMenuProps {
  items: LocalEmojiItem[];
  query: string;
  forceOpen: boolean;
  command: (props: { name: string }) => void;
  clientRect?: (() => DOMRect | null) | null;
  onDismiss: () => void;
}

const PageEmojiSuggestionMenu = forwardRef<
  EmojiSuggestionMenuHandle,
  EmojiSuggestionMenuProps
>(function PageEmojiSuggestionMenu(
  { items, query, forceOpen, command, clientRect, onDismiss },
  ref,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const shouldRender = query.length > 0 || forceOpen;

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = useCallback(
    (index: number) => {
      const target = items[index];
      if (!target) return;
      command({ name: target.name });
    },
    [command, items],
  );

  useLayoutEffect(() => {
    if (!shouldRender) {
      setPosition(null);
      return;
    }
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
      Math.max(VIEWPORT_PADDING, viewportWidth - menuWidth - VIEWPORT_PADDING),
    );

    setPosition({ top: rawTop, left: rawLeft });
  }, [clientRect, items, shouldRender]);

  useLayoutEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>(
      `[data-emoji-index="${selectedIndex}"]`,
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, items]);

  useEffect(() => {
    if (!shouldRender) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(event.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [onDismiss, shouldRender]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown(event: KeyboardEvent) {
        if (!shouldRender) return false;
        if (event.key === "Escape") {
          onDismiss();
          return true;
        }
        if (items.length === 0) return false;
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }),
    [items.length, onDismiss, selectItem, selectedIndex, shouldRender],
  );

  if (!shouldRender || !position) return null;

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={i18n.t("pages:logoPicker.inlineSuggestionAriaLabel")}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 100,
      }}
      className="max-h-72 w-56 space-y-0.5 overflow-y-auto rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-md"
    >
      {items.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          {i18n.t("pages:logoPicker.emptyEmojis")}
        </p>
      ) : (
        items.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <button
              key={item.name}
              type="button"
              role="option"
              aria-selected={isSelected}
              data-emoji-index={index}
              onMouseDown={(event) => {
                event.preventDefault();
                selectItem(index);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 truncate rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors",
                isSelected ? "bg-accent text-foreground" : "hover:bg-accent/70",
              )}
            >
              <span
                aria-hidden="true"
                className="grid size-5 shrink-0 place-items-center text-sm leading-none"
              >
                {item.emoji}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                :{item.name}:
              </span>
            </button>
          );
        })
      )}
    </div>
  );
});

const LocalPageEmojiNode = Emoji.extend({
  addStorage() {
    // Always treat bundled local Unicode emojis as supported so
    // `@tiptap/extension-emoji` skips canvas probing and never attempts any
    // external CDN image fallback.
    return {
      emojis: this.options.emojis,
      isSupported: () => true,
    };
  },
});

/**
 * Creates the local-first TipTap v3 `@tiptap/extension-emoji` extension wired
 * to `:` inline autocomplete and `/emoji` command opening.
 *
 * Node schema contract:
 * - `type`: `"emoji"` (inline)
 * - `attrs.name`: canonical emoji name (resolvable to Unicode char via
 *   `resolveEmojiCharByName` / `shortcodeToEmoji`)
 */
export function createPageEmojiExtension() {
  return LocalPageEmojiNode.configure({
    emojis: [...LOCAL_PAGE_EMOJIS],
    enableEmoticons: false,
    forceFallbackImages: false,
    suggestion: {
      char: ":",
      allow: ({ editor, state, range }) => {
        if (!editor.isEditable) return false;
        const $from = state.doc.resolve(range.from);
        const type = state.schema.nodes.emoji;
        if (!type) return false;
        return Boolean($from.parent.type.contentMatch.matchType(type));
      },
      items: ({ query }) => searchLocalEmojis(query, MAX_INLINE_SUGGESTIONS),
      render: () => {
        let renderer: ReactRenderer<
          EmojiSuggestionMenuHandle,
          EmojiSuggestionMenuProps
        > | null = null;
        let activeEditor: Editor | null = null;

        const destroy = () => {
          if (activeEditor) {
            forceOpenEmojiEditors.delete(activeEditor);
            activeEditor = null;
          }
          renderer?.destroy();
          renderer = null;
        };

        return {
          onStart: (
            props: SuggestionProps<LocalEmojiItem, { name: string }>,
          ) => {
            activeEditor = props.editor;
            const forceOpen = forceOpenEmojiEditors.has(props.editor);
            renderer = new ReactRenderer(PageEmojiSuggestionMenu, {
              props: {
                items: props.items,
                query: props.query,
                forceOpen,
                command: props.command,
                clientRect: props.clientRect,
                onDismiss: destroy,
              },
              editor: props.editor,
            });
          },
          onUpdate: (
            props: SuggestionProps<LocalEmojiItem, { name: string }>,
          ) => {
            const forceOpen = forceOpenEmojiEditors.has(props.editor);
            renderer?.updateProps({
              items: props.items,
              query: props.query,
              forceOpen,
              command: props.command,
              clientRect: props.clientRect,
              onDismiss: destroy,
            });
          },
          onKeyDown: (props: SuggestionKeyDownProps) => {
            if (!renderer) return false;
            return renderer.ref?.onKeyDown(props.event) ?? false;
          },
          onExit: () => {
            destroy();
          },
        };
      },
    },
  });
}
