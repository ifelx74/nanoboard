import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { GripVertical, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Sticky, StickyColorKey } from "@/lib/db/schema";
import { deleteSticky, updateSticky } from "@/lib/db/stickies";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { STICKY_COLORS_LIST } from "./color-palette";
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
};

export function StickyCard({
  sticky,
  onClose,
  className,
  showToolbar = true,
  dragHandleProps,
  isDragging = false,
}: Props) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const backgroundColor =
    STICKY_COLORS_LIST.find((c) => c.key === sticky.backgroundColor)
      ?.backgroundColor ?? STICKY_COLORS_LIST[0].backgroundColor;

  const debouncedSave = useCallback(
    (html: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await updateSticky(sticky.id, { contentHtml: html });
        } catch (error) {
          console.error("Failed to update sticky:", error);
        }
      }, 500);
    },
    [sticky.id],
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
    onFocus: () => setIsFocused(true),
  });

  // Keep content in sync if updated externally while not focused
  useEffect(() => {
    if (editor && !editor.isFocused && sticky.contentHtml !== editor.getHTML()) {
      editor.commands.setContent(sticky.contentHtml, { emitUpdate: false });
    }
  }, [editor, sticky.contentHtml]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
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
        ref={cardRef}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => {
          if (!cardRef.current?.contains(e.relatedTarget as Node)) {
            setIsFocused(false);
          }
        }}
        className={cn(
          "group/sticky relative flex h-fit w-full flex-col overflow-y-scroll scrollbar-none rounded-sm",
          isDragging && "opacity-50",
          className,
        )}
        style={{
          backgroundColor,
        }}
      >
        {/* Top hover drag handle matching Plane */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            aria-label="Drag sticky"
            className={cn(
              "absolute top-1.5 left-1/2 -translate-x-1/2 z-10 hidden rotate-90 cursor-grab items-center justify-center rounded-sm text-foreground/40 transition-colors hover:text-foreground active:cursor-grabbing group-hover/sticky:flex",
              isDragging && "cursor-grabbing flex",
            )}
          >
            <GripVertical className="size-3.5" />
          </div>
        )}

        {/* Optional top-right close button (e.g. in floating widget popup) */}
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute top-2.5 right-2.5 z-10 flex size-5 items-center justify-center rounded-sm text-foreground/50 transition-colors hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}

        {/* TipTap editor body */}
        <div className="nb-sticky-editor flex-1">
          <EditorContent editor={editor} />
        </div>

        {/* Plane animated bottom toolbar: smoothly expands on focus */}
        {showToolbar && (
          <div
            className={cn(
              "h-12.5 origin-top px-4 transition-all duration-300 ease-out",
              {
                "max-h-12.5 scale-y-100 opacity-100": isFocused,
                "invisible max-h-0 scale-y-0 opacity-0 pointer-events-none": !isFocused,
              },
            )}
          >
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
