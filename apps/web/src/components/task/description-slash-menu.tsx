import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";
import {
  Heading2,
  List,
  ListOrdered,
  ListTodo,
  SquareCode,
  TextQuote,
  Type,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface SlashItem {
  title: string;
  hint: string;
  icon: React.ReactNode;
  command: (context: { editor: Editor; range: Range }) => void;
}

export function useSlashItems(): SlashItem[] {
  const { t } = useTranslation("task");
  return useMemo(
    () => [
      {
        title: t("description.text"),
        hint: t("description.textHint"),
        icon: <Type className="size-4" aria-hidden="true" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) =>
          editor.chain().focus().deleteRange(range).setParagraph().run(),
      },
      {
        title: t("description.heading2"),
        hint: t("description.heading2Hint"),
        icon: <Heading2 className="size-4" aria-hidden="true" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) =>
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode("heading", { level: 2 })
            .run(),
      },
      {
        title: t("description.bulletList"),
        hint: t("description.bulletListHint"),
        icon: <List className="size-4" aria-hidden="true" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) =>
          editor.chain().focus().deleteRange(range).toggleBulletList().run(),
      },
      {
        title: t("description.taskList"),
        hint: t("description.taskListHint"),
        icon: <ListTodo className="size-4" aria-hidden="true" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) =>
          editor.chain().focus().deleteRange(range).toggleTaskList().run(),
      },
      {
        title: t("description.orderedList"),
        hint: t("description.orderedListHint"),
        icon: <ListOrdered className="size-4" aria-hidden="true" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) =>
          editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
      },
      {
        title: t("description.blockquote"),
        hint: t("description.blockquoteHint"),
        icon: <TextQuote className="size-4" aria-hidden="true" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) =>
          editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
      },
      {
        title: t("description.codeBlock"),
        hint: t("description.codeBlockHint"),
        icon: <SquareCode className="size-4" aria-hidden="true" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) =>
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
      },
    ],
    [t],
  );
}

interface SlashListProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
  clientRect: (() => DOMRect | null) | null | undefined;
}

const SlashList = forwardRef<
  { onKeyDown: (event: KeyboardEvent) => boolean },
  SlashListProps
>(function SlashList({ items, command, clientRect }, ref) {
  const { t } = useTranslation("task");
  const [selected, setSelected] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setSelected(0);
    setDismissed(false);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowUp") {
        setSelected((index) => (index + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelected((index) => (index + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selected];
        if (item) command(item);
        return true;
      }
      if (event.key === "Escape") {
        setDismissed(true);
        return true;
      }
      return false;
    },
  }));

  if (dismissed || items.length === 0) return null;
  const rect = clientRect?.();
  if (!rect) return null;

  return (
    <div
      role="listbox"
      aria-label={t("description.blockTypesLabel")}
      style={{
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 100,
      }}
      className="w-56 rounded-lg border border-border bg-popover p-1 shadow-md"
    >
      {items.map((item, index) => (
        <button
          key={item.title}
          type="button"
          role="option"
          aria-selected={index === selected}
          onMouseDown={(event) => {
            event.preventDefault();
            command(item);
          }}
          onMouseEnter={() => setSelected(index)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]",
            index === selected
              ? "bg-accent text-foreground"
              : "text-foreground/85",
          )}
        >
          <span className="shrink-0 text-muted-foreground">{item.icon}</span>
          <span className="min-w-0 flex-1 truncate font-medium">
            {item.title}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {item.hint}
          </span>
        </button>
      ))}
    </div>
  );
});

/**
 * "/" block menu: paragraph, heading-2, the three lists, blockquote, code block.
 */
export function createSlashCommands(items: SlashItem[]) {
  return Extension.create({
    name: "slashCommands",

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "/",
          items: ({ query }: { query: string }) =>
            items.filter(
              (item) =>
                item.title.toLowerCase().includes(query.toLowerCase()) ||
                item.hint.toLowerCase().includes(query.toLowerCase()),
            ),
          command: ({
            editor,
            range,
            props,
          }: {
            editor: Editor;
            range: Range;
            props: SlashItem;
          }) => {
            props.command({ editor, range });
          },
          render: () => {
            let renderer: ReactRenderer | null = null;
            return {
              onStart: (props: SuggestionProps) => {
                renderer = new ReactRenderer(SlashList, {
                  props: props as unknown as SlashListProps,
                  editor: props.editor,
                });
              },
              onUpdate: (props: SuggestionProps) => {
                renderer?.updateProps(props as unknown as SlashListProps);
              },
            onKeyDown: (props: SuggestionKeyDownProps) =>
              (
                renderer?.ref as unknown as {
                  onKeyDown: (event: KeyboardEvent) => boolean;
                } | null
              )?.onKeyDown(props.event) ?? false,
            onExit: () => {
              renderer?.destroy();
              renderer = null;
            },
          };
        },
      }),
    ];
  },
  });
}
