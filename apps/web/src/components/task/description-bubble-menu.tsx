import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  SquareCode,
  Strikethrough,
  TextQuote,
  Underline,
  Unlink,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function normalizeHref(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/|mailto:|#|\/)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function MenuButton({
  label,
  active,
  onRun,
  children,
}: {
  label: string;
  active?: boolean;
  onRun: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      data-active={active}
      onClick={onRun}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-accent data-[active=true]:text-foreground"
    >
      {children}
    </button>
  );
}

/**
 * Selection bubble toolbar: block group (heading, lists, quote, code)
 * then mark group (bold → link), Kaneo's order. The link button opens
 * an inline URL field instead of Kaneo's separate bubble-link editor.
 */
export default function DescriptionBubbleMenu({
  editor,
}: {
  editor: Editor;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");

  useEffect(() => {
    if (!linkOpen) return;
    setHref(editor.getAttributes("link").href ?? "");
  }, [linkOpen, editor]);

  function applyLink() {
    const normalized = normalizeHref(href);
    if (normalized) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setLinkOpen(false);
  }

  const iconClass = "size-4";

  return (
    <BubbleMenu
      editor={editor}
      className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md"
    >
      <MenuButton
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onRun={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className={iconClass} aria-hidden="true" />
      </MenuButton>
      <MenuButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onRun={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className={iconClass} aria-hidden="true" />
      </MenuButton>
      <MenuButton
        label="Task list"
        active={editor.isActive("taskList")}
        onRun={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListTodo className={iconClass} aria-hidden="true" />
      </MenuButton>
      <MenuButton
        label="Ordered list"
        active={editor.isActive("orderedList")}
        onRun={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className={iconClass} aria-hidden="true" />
      </MenuButton>
      <MenuButton
        label="Blockquote"
        active={editor.isActive("blockquote")}
        onRun={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <TextQuote className={iconClass} aria-hidden="true" />
      </MenuButton>
      <MenuButton
        label="Code block"
        active={editor.isActive("codeBlock")}
        onRun={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <SquareCode className={iconClass} aria-hidden="true" />
      </MenuButton>
      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />
      <MenuButton
        label="Bold"
        active={editor.isActive("bold")}
        onRun={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className={iconClass} aria-hidden="true" />
      </MenuButton>
      <MenuButton
        label="Italic"
        active={editor.isActive("italic")}
        onRun={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className={iconClass} aria-hidden="true" />
      </MenuButton>
      <MenuButton
        label="Underline"
        active={editor.isActive("underline")}
        onRun={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className={iconClass} aria-hidden="true" />
      </MenuButton>
      <MenuButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onRun={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className={iconClass} aria-hidden="true" />
      </MenuButton>
      <MenuButton
        label="Inline code"
        active={editor.isActive("code")}
        onRun={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className={iconClass} aria-hidden="true" />
      </MenuButton>
      <MenuButton
        label="Link"
        active={editor.isActive("link")}
        onRun={() => setLinkOpen((open) => !open)}
      >
        <Link2 className={iconClass} aria-hidden="true" />
      </MenuButton>
      {linkOpen && (
        <span className="flex items-center gap-1 pl-1">
          <input
            autoFocus
            value={href}
            aria-label="Link URL"
            placeholder="https://…"
            onChange={(event) => setHref(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              } else if (event.key === "Escape") {
                setLinkOpen(false);
              }
            }}
            className={cn(
              "h-7 w-44 rounded-md border border-input bg-background px-2 text-xs",
              "outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
            )}
          />
          <MenuButton label="Apply link" onRun={applyLink}>
            <Link2 className={iconClass} aria-hidden="true" />
          </MenuButton>
          {editor.isActive("link") && (
            <MenuButton
              label="Remove link"
              onRun={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setLinkOpen(false);
              }}
            >
              <Unlink className={iconClass} aria-hidden="true" />
            </MenuButton>
          )}
        </span>
      )}
    </BubbleMenu>
  );
}
