import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { updateTaskDescription } from "@/lib/db/queries";
import type { Task } from "@/lib/db/schema";
import { createDescriptionExtensions } from "@/lib/editor/preset";
import { formatMarkdown } from "@/lib/editor/markdown";
import { toast } from "@/lib/toast";
import DescriptionBubbleMenu from "./description-bubble-menu";
import { SlashCommands } from "./description-slash-menu";
import "./task-description.css";

const AUTOSAVE_DELAY = 700;

type SaveStatus = "idle" | "saving" | "saved" | "failed";

/**
 * Task description editor (TipTap over the Markdown `description`
 * column, Kaneo-style): bubble toolbar + slash menu, debounced autosave
 * with status and retry. The drawer remounts per task (`key={task.id}`),
 * so hydration runs once on mount without undo pollution.
 */
export default function TaskDescription({ task }: { task: Task }) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const savedRef = useRef(task.description);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistRef = useRef<(() => void) | null>(null);

  const editor = useEditor(
    {
      extensions: [
        ...createDescriptionExtensions("Add a description"),
        SlashCommands,
      ],
      content: "",
      onUpdate: () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setStatus("saving");
        timerRef.current = setTimeout(() => persistRef.current?.(), AUTOSAVE_DELAY);
      },
    },
    [],
  );

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
              : "Failed to save description",
          );
        },
      );
    };
  }, [editor, task.id]);

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
        <EditorContent editor={editor} aria-label="Task description" />
      </div>
      {editor && <DescriptionBubbleMenu editor={editor} />}
      <div aria-live="polite" className="min-h-4 text-[11px]">
        {status === "saving" && (
          <span className="text-muted-foreground">Saving…</span>
        )}
        {status === "saved" && (
          <span className="text-muted-foreground">Saved</span>
        )}
        {status === "failed" && (
          <span className="flex items-center gap-1.5 text-destructive">
            Couldn&apos;t save
            <button
              type="button"
              onClick={() => persistRef.current?.()}
              className="font-medium underline underline-offset-2 outline-none hover:text-destructive/80 focus-visible:ring-2 focus-visible:ring-ring"
            >
              Retry
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
