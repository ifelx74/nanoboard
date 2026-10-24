import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  ListTodo,
  type LucideIcon,
  Palette,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useClickOutside } from "@/hooks/use-click-outside";
import type { StickyColorKey } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { ColorPalette } from "./color-palette";

type FormattingAction = {
  label: string;
  shortcut: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  command: (editor: Editor) => void;
};

const FORMATTING_ACTIONS: FormattingAction[] = [
  {
    label: "Bold",
    shortcut: "Cmd + B",
    icon: Bold,
    isActive: (editor) => editor.isActive("bold"),
    command: (editor) => {
      editor.chain().focus().toggleBold().run();
    },
  },
  {
    label: "Italic",
    shortcut: "Cmd + I",
    icon: Italic,
    isActive: (editor) => editor.isActive("italic"),
    command: (editor) => {
      editor.chain().focus().toggleItalic().run();
    },
  },
  {
    label: "To-do list",
    shortcut: "Cmd + Shift + 9",
    icon: ListTodo,
    isActive: (editor) => editor.isActive("taskList"),
    command: (editor) => {
      editor.chain().focus().toggleTaskList().run();
    },
  },
];

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

  useClickOutside(colorPaletteRef, () => setShowColorPalette(false));

  // Toolbar buttons suppress their mousedown so clicking a control never
  // pulls focus off the editor (which would exit edit mode).
  const keepEditorFocus = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  return (
    <TooltipProvider>
      <div className="flex h-full w-full items-center justify-between">
        <div
          className="relative my-auto flex items-center gap-4"
          ref={colorPaletteRef}
        >
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
                onMouseDown={keepEditorFocus}
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
              {FORMATTING_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Tooltip key={action.label}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={!editor}
                        aria-label={action.label}
                        onMouseDown={keepEditorFocus}
                        onClick={() => editor && action.command(editor)}
                        className={cn(
                          "grid aspect-square place-items-center rounded-xs p-0.5 text-foreground/50 transition-colors hover:text-foreground focus:outline-none",
                          editor &&
                            action.isActive(editor) &&
                            "text-foreground font-bold",
                        )}
                      >
                        <Icon className="size-3.5" strokeWidth={2.5} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span className="inline-flex items-center gap-1.5">
                        {action.label} <Kbd>{action.shortcut}</Kbd>
                      </span>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Delete"
              onMouseDown={keepEditorFocus}
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
