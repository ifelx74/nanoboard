import type { Editor } from "@tiptap/react";
import { Bold, Italic, ListTodo, Palette, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { StickyColorKey } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { ColorPalette } from "./color-palette";

type Props = {
  editor: Editor | null;
  currentColor: StickyColorKey;
  onColorChange: (color: StickyColorKey) => void;
  onDelete: () => void;
};

export function StickyToolbar({
  editor,
  currentColor,
  onColorChange,
  onDelete,
}: Props) {
  const [showColorPalette, setShowColorPalette] = useState(false);
  const colorPaletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        colorPaletteRef.current &&
        !colorPaletteRef.current.contains(e.target as Node)
      ) {
        setShowColorPalette(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-full w-full items-center justify-between">
        <div className="relative my-auto flex items-center gap-4" ref={colorPaletteRef}>
          {/* Color palette popover */}
          {showColorPalette && (
            <ColorPalette
              selectedColor={currentColor}
              onSelectColor={(color) => {
                onColorChange(color);
                setShowColorPalette(false);
              }}
            />
          )}

          {/* Color palette trigger */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Background color"
                onClick={() => setShowColorPalette(!showColorPalette)}
                className="flex text-foreground/50 transition-colors hover:text-foreground focus:outline-none"
              >
                <Palette className="my-auto size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">Background color</p>
            </TooltipContent>
          </Tooltip>

          {/* Formatting items */}
          <div className="my-auto flex w-fit items-stretch justify-between gap-4 rounded-sm p-1">
            <div className="my-auto flex items-stretch gap-4">
              {/* Bold */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={!editor}
                    aria-label="Bold"
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    className={cn(
                      "grid aspect-square place-items-center rounded-xs p-0.5 text-foreground/50 transition-colors hover:text-foreground focus:outline-none",
                      editor?.isActive("bold") && "text-foreground font-bold",
                    )}
                  >
                    <Bold className="size-3.5" strokeWidth={2.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Bold</p>
                </TooltipContent>
              </Tooltip>

              {/* Italic */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={!editor}
                    aria-label="Italic"
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    className={cn(
                      "grid aspect-square place-items-center rounded-xs p-0.5 text-foreground/50 transition-colors hover:text-foreground focus:outline-none",
                      editor?.isActive("italic") && "text-foreground font-bold",
                    )}
                  >
                    <Italic className="size-3.5" strokeWidth={2.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Italic</p>
                </TooltipContent>
              </Tooltip>

              {/* Checklist */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={!editor}
                    aria-label="To-do list"
                    onClick={() => editor?.chain().focus().toggleTaskList().run()}
                    className={cn(
                      "grid aspect-square place-items-center rounded-xs p-0.5 text-foreground/50 transition-colors hover:text-foreground focus:outline-none",
                      editor?.isActive("taskList") && "text-foreground font-bold",
                    )}
                  >
                    <ListTodo className="size-3.5" strokeWidth={2.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">To-do list</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Delete"
              onClick={onDelete}
              className="my-auto text-foreground/50 transition-colors hover:text-destructive focus:outline-none"
            >
              <Trash2 className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Delete</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
