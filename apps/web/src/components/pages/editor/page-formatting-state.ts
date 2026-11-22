import { useEditorState, type Editor } from "@tiptap/react";
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
  Quote,
  Type,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { isPageColorKey, type PageColorKey } from "@/lib/pages/colors";
import { toggleSmartCode } from "@/lib/pages/editor-commands";

export interface PageFormattingState {
  headingLevel: 1 | 2 | 3 | 4 | 5 | 6 | null;
  textColor: PageColorKey | undefined;
  backgroundColor: PageColorKey | undefined;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  alignLeft: boolean;
  alignCenter: boolean;
  alignRight: boolean;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  blockquote: boolean;
  code: boolean;
  codeBlock: boolean;
  linkActive: boolean;
  linkHref: string;
}

export interface PageBlockTypeItem {
  key: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  run: () => void;
}

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

/**
 * Shared reactive formatting-state selector for both `PageStickyToolbar` and
 * `PageBubbleMenu`.
 */
export function selectPageFormattingState(editor: Editor): PageFormattingState {
  const colorAttrs = editor.getAttributes("pageColor") as {
    color?: unknown;
    backgroundColor?: unknown;
  };
  const linkAttrs = editor.getAttributes("link") as { href?: string };

  let headingLevel: 1 | 2 | 3 | 4 | 5 | 6 | null = null;
  for (const level of HEADING_LEVELS) {
    if (editor.isActive("heading", { level })) {
      headingLevel = level;
      break;
    }
  }

  return {
    headingLevel,
    textColor: isPageColorKey(colorAttrs.color) ? colorAttrs.color : undefined,
    backgroundColor: isPageColorKey(colorAttrs.backgroundColor)
      ? colorAttrs.backgroundColor
      : undefined,
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    strike: editor.isActive("strike"),
    alignLeft: editor.isActive({ textAlign: "left" }),
    alignCenter: editor.isActive({ textAlign: "center" }),
    alignRight: editor.isActive({ textAlign: "right" }),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    taskList: editor.isActive("taskList"),
    blockquote: editor.isActive("blockquote"),
    code: editor.isActive("code"),
    codeBlock: editor.isActive("codeBlock"),
    linkActive: editor.isActive("link"),
    linkHref: linkAttrs.href ?? "",
  };
}

export function usePageFormattingState(editor: Editor): PageFormattingState {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => selectPageFormattingState(e),
  });
}

/**
 * Builds the `Text` + `H1`..`H6` typography dropdown entries shared by the
 * sticky toolbar and bubble menu.
 */
export function usePageTypographyItems(
  editor: Editor,
  state: PageFormattingState,
  options?: { isTextActive?: boolean },
): PageBlockTypeItem[] {
  const { t } = useTranslation("pages");
  const isTextActive = options?.isTextActive ?? state.headingLevel === null;

  return [
    {
      key: "text",
      label: t("editor.blocks.text"),
      icon: Type,
      active: isTextActive,
      run: () => editor.chain().focus().setParagraph().run(),
    },
    {
      key: "h1",
      label: t("editor.blocks.h1"),
      icon: Heading1,
      active: state.headingLevel === 1,
      run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      key: "h2",
      label: t("editor.blocks.h2"),
      icon: Heading2,
      active: state.headingLevel === 2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      key: "h3",
      label: t("editor.blocks.h3"),
      icon: Heading3,
      active: state.headingLevel === 3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      key: "h4",
      label: t("editor.blocks.h4"),
      icon: Heading4,
      active: state.headingLevel === 4,
      run: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
    },
    {
      key: "h5",
      label: t("editor.blocks.h5"),
      icon: Heading5,
      active: state.headingLevel === 5,
      run: () => editor.chain().focus().toggleHeading({ level: 5 }).run(),
    },
    {
      key: "h6",
      label: t("editor.blocks.h6"),
      icon: Heading6,
      active: state.headingLevel === 6,
      run: () => editor.chain().focus().toggleHeading({ level: 6 }).run(),
    },
  ];
}

/**
 * Builds the full block-type selector list for the floating Bubble Menu
 * (`Text`, `H1`..`H6`, lists, quote, and smart code).
 */
export function usePageBlockTypeItems(
  editor: Editor,
  state: PageFormattingState,
): PageBlockTypeItem[] {
  const { t } = useTranslation("pages");
  const isPlainText =
    state.headingLevel === null &&
    !state.bulletList &&
    !state.orderedList &&
    !state.taskList &&
    !state.blockquote &&
    !state.code;

  const typographyItems = usePageTypographyItems(editor, state, {
    isTextActive: isPlainText,
  });

  return [
    ...typographyItems,
    {
      key: "bulletList",
      label: t("editor.blocks.bulletList"),
      icon: List,
      active: state.bulletList,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: "orderedList",
      label: t("editor.blocks.orderedList"),
      icon: ListOrdered,
      active: state.orderedList,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      key: "taskList",
      label: t("editor.blocks.taskList"),
      icon: ListTodo,
      active: state.taskList,
      run: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      key: "quote",
      label: t("editor.blocks.quote"),
      icon: Quote,
      active: state.blockquote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      key: "code",
      label: t("editor.blocks.code"),
      icon: Code,
      active: state.code,
      run: () => toggleSmartCode(editor),
    },
  ];
}
