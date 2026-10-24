import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { GripVertical, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Sticky, StickyColorKey } from "@/lib/db/schema";
import { deleteSticky, updateSticky } from "@/lib/db/stickies";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { stickyBackgroundColor } from "./color-palette";
import { StickyDeleteDialog } from "./sticky-delete-dialog";
import "./sticky-editor.css";
import { StickyToolbar } from "./sticky-toolbar";

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

export function StickyCard({
  sticky,
  onClose,
  className,
  showToolbar = true,
  dragHandleProps,
  isDragging = false,
  maxEditorHeight = 540,
}: Props) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHtmlRef = useRef<string | null>(null);

  const backgroundColor = stickyBackgroundColor(sticky.backgroundColor);

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

  const debouncedSave = useCallback(
    (html: string) => {
      pendingHtmlRef.current = html;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
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
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getHTML());
    },
  });

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
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      const pendingHtml = pendingHtmlRef.current;
      if (pendingHtml !== null) void saveContent(pendingHtml);
    };
  }, [saveContent]);

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

        {/* TipTap editor body */}
        <div className="nb-sticky-editor flex-1">
          <EditorContent editor={editor} />
        </div>

        {/* Plane keeps the formatting toolbar permanently visible at the
            bottom of every note. */}
        {showToolbar && (
          <div className="h-15 origin-top px-4">
            <StickyToolbar
              editor={editor}
              currentColor={sticky.backgroundColor}
              onColorChange={handleColorChange}
              onDelete={() => setDeleteDialogOpen(true)}
            />
          </div>
        )}
      </div>
    </>
  );
}
