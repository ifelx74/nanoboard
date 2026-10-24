import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { GripVertical, X } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Sticky, StickyColorKey } from "@/lib/db/schema";
import { deleteSticky, isStickyEmpty, updateSticky } from "@/lib/db/stickies";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { stickyBackgroundColor } from "./color-palette";
import { StickyDeleteDialog } from "./sticky-delete-dialog";
import "./sticky-editor.css";
import { StickyToolbar } from "./sticky-toolbar";

/**
 * Static markup for an empty note; rendered as a placeholder by the
 * `.is-editor-empty` rule in sticky-editor.css.
 */
const EMPTY_NOTE_HTML =
  '<p class="is-editor-empty" data-placeholder="Click to type here"></p>';

type Props = {
  sticky: Sticky;
  onClose?: () => void;
  className?: string;
  showToolbar?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  /**
   * Height budget for the note body. Plane uses 588px on the stickies page
   * and 540px everywhere else (popovers, the "all stickies" modal).
   */
  maxEditorHeight?: number;
};

/**
 * A note renders its HTML statically and mounts a tiptap editor only while
 * focused, so a board of N notes keeps at most one ProseMirror instance
 * alive (the drag preview and unfocused cards never pay for one).
 */
export const StickyCard = memo(function StickyCard({
  sticky,
  onClose,
  className,
  showToolbar = true,
  dragHandleProps,
  isDragging = false,
  maxEditorHeight = 540,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);

  const backgroundColor = stickyBackgroundColor(sticky.backgroundColor);

  const handleEditStart = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleEditEnd = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleEditorReady = useCallback((editor: Editor | null) => {
    setActiveEditor(editor);
  }, []);

  const handleColorChange = async (color: StickyColorKey) => {
    try {
      await updateSticky(sticky.id, { backgroundColor: color });
    } catch (error) {
      console.error("Failed to update sticky color:", error);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteSticky(sticky.id);
      toast.success("Sticky removed");
      onClose?.();
    } catch (error) {
      toast.error("Failed to remove sticky");
      console.error(error);
    }
  };

  return (
    <>
      <StickyDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
      />

      <div
        className={cn(
          "group/sticky relative flex h-fit w-full flex-col overflow-y-scroll scrollbar-none rounded-sm",
          className,
        )}
        style={
          {
            backgroundColor,
            "--nb-sticky-max-height": `${maxEditorHeight}px`,
          } as CSSProperties
        }
      >
        {/* Hover drag handle, matching Plane's `StickyItemDragHandle`. */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            aria-label="Drag sticky"
            className={cn(
              "absolute top-1 left-1/2 z-10 hidden -translate-x-1/2 rotate-90 cursor-grab items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground group-hover/sticky:flex",
              isDragging && "cursor-grabbing flex",
            )}
          >
            <GripVertical className="size-3" />
          </div>
        )}

        {/* Close button sits on its own row, the way Plane renders it in the
            floating popover. */}
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex flex-shrink-0 justify-end p-2.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}

        {/* Note body: static HTML until focused, then a live editor. */}
        <div className="nb-sticky-editor flex-1">
          {isEditing ? (
            <StickyEditor
              sticky={sticky}
              onEditorReady={handleEditorReady}
              onEditEnd={handleEditEnd}
            />
          ) : (
            <div
              className="tiptap nb-sticky-static"
              tabIndex={0}
              onFocus={handleEditStart}
              dangerouslySetInnerHTML={{
                __html: isStickyEmpty(sticky.contentHtml)
                  ? EMPTY_NOTE_HTML
                  : sticky.contentHtml,
              }}
            />
          )}
        </div>

        {/* Plane keeps the formatting toolbar permanently visible at the
            bottom of every note; formatting actions wait for a focused
            editor, while color and delete work on the static card. */}
        {showToolbar && (
          <div className="h-15 origin-top px-4">
            <StickyToolbar
              editor={activeEditor}
              currentColor={sticky.backgroundColor}
              onColorChange={handleColorChange}
              onDelete={() => setDeleteDialogOpen(true)}
            />
          </div>
        )}
      </div>
    </>
  );
});

type StickyEditorProps = {
  sticky: Sticky;
  onEditorReady: (editor: Editor | null) => void;
  onEditEnd: () => void;
};

/** Editing surface for a focused note; owns the debounced-save lifecycle. */
function StickyEditor({ sticky, onEditorReady, onEditEnd }: StickyEditorProps) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHtmlRef = useRef<string | null>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveContent = useCallback(
    async (html: string) => {
      try {
        await updateSticky(sticky.id, { contentHtml: html });
      } catch (error) {
        console.error("Failed to update sticky:", error);
      }
    },
    [sticky.id],
  );

  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const pendingHtml = pendingHtmlRef.current;
    pendingHtmlRef.current = null;
    if (pendingHtml !== null) void saveContent(pendingHtml);
  }, [saveContent]);

  const debouncedSave = useCallback(
    (html: string) => {
      pendingHtmlRef.current = html;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        pendingHtmlRef.current = null;
        void saveContent(html);
      }, 500);
    },
    [saveContent],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: "Click to type here",
      }),
    ],
    content: sticky.contentHtml,
    autofocus: "end",
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getHTML());
    },
    // Toolbar controls suppress their own mousedown, so focus leaving the
    // editor means the user clicked elsewhere: flush and drop back to the
    // static view. Deferred so a control that refocuses wins the race.
    onBlur: ({ editor }) => {
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = setTimeout(() => {
        exitTimeoutRef.current = null;
        if (!editor.isDestroyed && !editor.isFocused) {
          flushSave();
          onEditEnd();
        }
      }, 150);
    },
    onFocus: () => {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
    },
    editorProps: {
      handleKeyDown: (_, event) => {
        if (event.key === "Escape") {
          flushSave();
          onEditEnd();
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor) onEditorReady(editor);
    return () => onEditorReady(null);
  }, [editor, onEditorReady]);

  // Keep content in sync if updated externally while not focused
  useEffect(() => {
    if (editor && !editor.isFocused && sticky.contentHtml !== editor.getHTML()) {
      editor.commands.setContent(sticky.contentHtml, { emitUpdate: false });
    }
  }, [editor, sticky.contentHtml]);

  // Flush a pending save on unmount instead of dropping it — e.g. when the
  // search filter removes the card mid-debounce.
  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
      flushSave();
    };
  }, [flushSave]);

  return <EditorContent editor={editor} />;
}
