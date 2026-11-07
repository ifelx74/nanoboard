import { EditorContent, useEditor } from "@tiptap/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { createDescriptionExtensions } from "@/lib/editor/preset";
import { formatMarkdown } from "@/lib/editor/markdown";
import DescriptionBubbleMenu from "./description-bubble-menu";
import {
  createSlashCommands,
  useSlashItems,
} from "./description-slash-menu";
import "./task-description.css";

/**
 * Compact description editor for the create-task dialog: the same
 * extension preset as the drawer (bubble toolbar + slash menu), but
 * uncontrolled — markdown is lifted via `onMarkdown` and persisted once
 * on submit. Remount via `key` to reset (see the dialog's reset flow).
 */
export default function TaskDescriptionInput({
  onMarkdown,
  placeholder,
  className,
}: {
  onMarkdown: (markdown: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useTranslation("task");
  const slashItems = useSlashItems();
  const resolvedPlaceholder = placeholder ?? t("description.placeholder");
  const extensions = useMemo(
    () => [
      ...createDescriptionExtensions(resolvedPlaceholder),
      createSlashCommands(slashItems),
    ],
    [resolvedPlaceholder, slashItems],
  );

  const editor = useEditor(
    {
      extensions,
      content: "",
      onUpdate: ({ editor: next }) => {
        onMarkdown(formatMarkdown(next.getMarkdown()));
      },
    },
    [extensions],
  );

  return (
    <div className={cn("nb-description", className)}>
      <EditorContent
        editor={editor}
        aria-label={t("description.ariaLabel")}
      />
      {editor && <DescriptionBubbleMenu editor={editor} />}
    </div>
  );
}
