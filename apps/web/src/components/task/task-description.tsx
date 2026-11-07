import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { updateTaskDescription } from "@/lib/db/queries";
import type { Task } from "@/lib/db/schema";
import { createDescriptionExtensions } from "@/lib/editor/preset";
import { formatMarkdown } from "@/lib/editor/markdown";
import { i18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import DescriptionBubbleMenu from "./description-bubble-menu";
import {
  createSlashCommands,
  useSlashItems,
} from "./description-slash-menu";
import "./task-description.css";

const AUTOSAVE_DELAY = 700;

export type DescriptionSaveStatus = "idle" | "saving" | "saved" | "failed";

type TaskDescriptionProps = {
  task: Task;
  disabled?: boolean;
  onStatusChange?: (status: DescriptionSaveStatus) => void;
  retryRef?: { current: (() => void) | null };
};

/**
 * Task description editor: bubble toolbar + slash menu, debounced autosave
 * with status and retry. The drawer remounts per task (`key={task.id}`),
 * so hydration runs once on mount without undo pollution.
 */
export default function TaskDescription({
  task,
  disabled = false,
  onStatusChange,
  retryRef,
}: TaskDescriptionProps) {
  const { t } = useTranslation("task");
  const slashItems = useSlashItems();
  const [status, setStatus] = useState<DescriptionSaveStatus>("idle");
  const savedRef = useRef(task.description);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistRef = useRef<(() => void) | null>(null);

  const editor = useEditor(
    {
      extensions: [
        ...createDescriptionExtensions(t("description.placeholder")),
        createSlashCommands(slashItems),
      ],
      content: "",
      editable: !disabled,
      onUpdate: () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setStatus("saving");
        timerRef.current = setTimeout(
          () => persistRef.current?.(),
          AUTOSAVE_DELAY,
        );
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor) return undefined;
    editor.setEditable(!disabled);
    return undefined;
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return undefined;
    editor.commands.setContent(task.description, {
      emitUpdate: false,
      contentType: "markdown",
    });
    savedRef.current = task.description;
    setStatus("idle");
    // Mount-only hydration: the drawer remounts per task (key={task.id}),
    // so task.description is fixed for this instance's lifetime.
    return undefined;
  }, [editor]);

  useEffect(() => {
    persistRef.current = () => {
      if (!editor) return;
      const markdown = formatMarkdown(editor.getMarkdown());
      if (markdown === savedRef.current) {
        setStatus("saved");
        return;
      }
      setStatus("saving");
      void updateTaskDescription(task.id, markdown).then(
        () => {
          savedRef.current = markdown;
          setStatus("saved");
        },
        (error: unknown) => {
          setStatus("failed");
          toast.error(
            error instanceof Error
              ? error.message
              : i18n.t("task:drawer.descriptionFailed"),
          );
        },
      );
    };
  }, [editor, task.id]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useEffect(() => {
    if (!retryRef) return undefined;
    retryRef.current = () => persistRef.current?.();
    return () => {
      retryRef.current = null;
    };
  }, [retryRef]);

  // Flush a pending edit if the drawer closes mid-debounce.
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        persistRef.current?.();
      }
    },
    [],
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="nb-description">
        <EditorContent
          editor={editor}
          aria-label={t("description.ariaLabel")}
        />
      </div>
      {editor && !disabled && <DescriptionBubbleMenu editor={editor} />}
    </div>
  );
}
