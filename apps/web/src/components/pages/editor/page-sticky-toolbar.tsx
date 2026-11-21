import { useEditorState, type Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Strikethrough,
  Table2,
  Type,
  Underline,
} from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isPageColorKey, type PageColorKey } from "@/lib/pages/colors";
import {
  toggleSmartCode,
  type PageTextAlignment,
} from "@/lib/pages/editor-commands";
import { cn } from "@/lib/utils";
import {
  PageColorPickerPanel,
  PageColorTriggerPreview,
} from "./page-color-picker-panel";

export interface PageStickyToolbarProps {
  editor: Editor | null;
  isEditable: boolean;
  isFullWidth: boolean;
  isStickyToolbarEnabled: boolean;
  /** Optional insert callback wired by Ticket 05 (3x3 Table). */
  onInsertTable?: (editor: Editor) => void;
  /** Optional insert callback wired by Ticket 06 (Image block). */
  onInsertImage?: (editor: Editor) => void;
  /** Optional extra insert buttons slot for downstream extensions. */
  extraInsertSlot?: ReactNode;
  /**
   * Optional right-side slot reserved for Ticket 07's right navigation pane
   * toggle. Renders inline at the right end of the sticky toolbar when visible,
   * and floats at top-right (`h-[52px]`) whenever the toolbar is hidden or
   * the page is read-only.
   */
  rightSlot?: ReactNode;
}

function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(
    navigator.platform || navigator.userAgent,
  );
}

function ToolbarDivider() {
  return (
    <span aria-hidden="true" className="mx-1.5 h-4 w-px shrink-0 bg-border" />
  );
}

function ToolbarIconButton({
  label,
  shortcut,
  active,
  isToggle = true,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  isToggle?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={isToggle ? Boolean(active) : undefined}
            data-active={isToggle ? Boolean(active) : undefined}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
            className={cn(
              "grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              isToggle && active && "bg-accent text-foreground",
            )}
          >
            {children}
          </button>
        }
      />
      <TooltipContent side="bottom">
        <span className="flex items-center gap-2">
          <span>{label}</span>
          {shortcut && (
            <kbd className="rounded-xs bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
              {shortcut}
            </kbd>
          )}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

function PageStickyToolbarInner({
  editor,
  onInsertTable,
  onInsertImage,
  extraInsertSlot,
}: {
  editor: Editor;
  onInsertTable?: (editor: Editor) => void;
  onInsertImage?: (editor: Editor) => void;
  extraInsertSlot?: ReactNode;
}) {
  const { t } = useTranslation("pages");
  const mod = isApplePlatform() ? "⌘" : "Ctrl+";

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const colorAttrs = e.getAttributes("pageColor") as {
        color?: unknown;
        backgroundColor?: unknown;
      };
      const activeTextColor: PageColorKey | undefined = isPageColorKey(
        colorAttrs.color,
      )
        ? colorAttrs.color
        : undefined;
      const activeBackgroundColor: PageColorKey | undefined = isPageColorKey(
        colorAttrs.backgroundColor,
      )
        ? colorAttrs.backgroundColor
        : undefined;

      let headingLevel: 1 | 2 | 3 | 4 | 5 | 6 | null = null;
      for (const level of [1, 2, 3, 4, 5, 6] as const) {
        if (e.isActive("heading", { level })) {
          headingLevel = level;
          break;
        }
      }

      return {
        headingLevel,
        activeTextColor,
        activeBackgroundColor,
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        alignLeft: e.isActive({ textAlign: "left" }),
        alignCenter: e.isActive({ textAlign: "center" }),
        alignRight: e.isActive({ textAlign: "right" }),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        taskList: e.isActive("taskList"),
        blockquote: e.isActive("blockquote"),
        code: e.isActive("code") || e.isActive("codeBlock"),
      };
    },
  });

  const typographyItems = [
    {
      key: "text",
      label: t("editor.blocks.text"),
      icon: Type,
      active: state.headingLevel === null,
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

  const activeTypography =
    typographyItems.find((item) => item.active) ?? typographyItems[0];

  const setAlignment = (alignment: PageTextAlignment) => {
    editor.chain().focus().setTextAlign(alignment).run();
  };

  const hasInsertControls = Boolean(
    onInsertTable || onInsertImage || extraInsertSlot,
  );
  const iconClass = "size-3.5";

  return (
    <TooltipProvider delay={300}>
      <div
        role="toolbar"
        aria-label={t("editor.toolbar.ariaLabel")}
        className="flex items-center overflow-x-auto py-1"
      >
        {/* 1. Typography dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={t("editor.toolbar.typography")}
                onMouseDown={(event) => event.preventDefault()}
                className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent data-popup-open:text-foreground"
              >
                <span className="max-w-24 truncate">
                  {activeTypography.label}
                </span>
                <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
              </button>
            }
          />
          <DropdownMenuContent align="start" side="bottom" className="w-44">
            {typographyItems.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem
                  key={item.key}
                  onClick={item.run}
                  className="justify-between text-xs"
                >
                  <span className="flex items-center gap-2">
                    <Icon
                      className="size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </span>
                  {item.active && (
                    <Check
                      className="size-3.5 text-brand-800"
                      aria-hidden="true"
                    />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolbarDivider />

        {/* 2. Color popover */}
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={t("editor.colors.trigger")}
                onMouseDown={(event) => event.preventDefault()}
                className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent data-popup-open:text-foreground"
              >
                <span>{t("editor.colors.trigger")}</span>
                <PageColorTriggerPreview
                  activeTextColor={state.activeTextColor}
                  activeBackgroundColor={state.activeBackgroundColor}
                />
                <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
              </button>
            }
          />
          <PopoverContent align="start" side="bottom" className="w-auto p-0">
            <PageColorPickerPanel
              activeTextColor={state.activeTextColor}
              activeBackgroundColor={state.activeBackgroundColor}
              onSelectTextColor={(color) => {
                if (color) {
                  editor.chain().focus().setTextColor(color).run();
                } else {
                  editor.chain().focus().unsetTextColor().run();
                }
              }}
              onSelectBackgroundColor={(color) => {
                if (color) {
                  editor.chain().focus().setBackgroundColor(color).run();
                } else {
                  editor.chain().focus().unsetBackgroundColor().run();
                }
              }}
            />
          </PopoverContent>
        </Popover>

        <ToolbarDivider />

        {/* 3. Basic marks */}
        <div className="flex items-center gap-0.5">
          <ToolbarIconButton
            label={t("editor.marks.bold")}
            shortcut={`${mod}B`}
            active={state.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className={iconClass} aria-hidden="true" />
          </ToolbarIconButton>
          <ToolbarIconButton
            label={t("editor.marks.italic")}
            shortcut={`${mod}I`}
            active={state.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className={iconClass} aria-hidden="true" />
          </ToolbarIconButton>
          <ToolbarIconButton
            label={t("editor.marks.underline")}
            shortcut={`${mod}U`}
            active={state.underline}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <Underline className={iconClass} aria-hidden="true" />
          </ToolbarIconButton>
          <ToolbarIconButton
            label={t("editor.marks.strikethrough")}
            shortcut={`${mod}Shift+S`}
            active={state.strike}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className={iconClass} aria-hidden="true" />
          </ToolbarIconButton>
        </div>

        <ToolbarDivider />

        {/* 4. Alignment */}
        <div className="flex items-center gap-0.5">
          <ToolbarIconButton
            label={t("editor.align.left")}
            shortcut={`${mod}Shift+L`}
            active={state.alignLeft}
            onClick={() => setAlignment("left")}
          >
            <AlignLeft className={iconClass} aria-hidden="true" />
          </ToolbarIconButton>
          <ToolbarIconButton
            label={t("editor.align.center")}
            shortcut={`${mod}Shift+E`}
            active={state.alignCenter}
            onClick={() => setAlignment("center")}
          >
            <AlignCenter className={iconClass} aria-hidden="true" />
          </ToolbarIconButton>
          <ToolbarIconButton
            label={t("editor.align.right")}
            shortcut={`${mod}Shift+R`}
            active={state.alignRight}
            onClick={() => setAlignment("right")}
          >
            <AlignRight className={iconClass} aria-hidden="true" />
          </ToolbarIconButton>
        </div>

        <ToolbarDivider />

        {/* 5. Lists */}
        <div className="flex items-center gap-0.5">
          <ToolbarIconButton
            label={t("editor.blocks.bulletList")}
            shortcut={`${mod}Shift+8`}
            active={state.bulletList}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className={iconClass} aria-hidden="true" />
          </ToolbarIconButton>
          <ToolbarIconButton
            label={t("editor.blocks.orderedList")}
            shortcut={`${mod}Shift+7`}
            active={state.orderedList}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className={iconClass} aria-hidden="true" />
          </ToolbarIconButton>
          <ToolbarIconButton
            label={t("editor.blocks.taskList")}
            shortcut={`${mod}Shift+9`}
            active={state.taskList}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <ListTodo className={iconClass} aria-hidden="true" />
          </ToolbarIconButton>
        </div>

        <ToolbarDivider />

        {/* 6. Blocks: Quote + smart Code */}
        <div className="flex items-center gap-0.5">
          <ToolbarIconButton
            label={t("editor.blocks.quote")}
            shortcut={`${mod}Shift+B`}
            active={state.blockquote}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className={iconClass} aria-hidden="true" />
          </ToolbarIconButton>
          <ToolbarIconButton
            label={t("editor.blocks.code")}
            shortcut={`${mod}E`}
            active={state.code}
            onClick={() => toggleSmartCode(editor)}
          >
            <Code className={iconClass} aria-hidden="true" />
          </ToolbarIconButton>
        </div>

        {/* 7. Inserts (hooks for Table & Image from Tickets 05 & 06) */}
        {hasInsertControls && (
          <>
            <ToolbarDivider />
            <div className="flex items-center gap-0.5">
              {onInsertTable && (
                <ToolbarIconButton
                  label={t("editor.toolbar.insertTable")}
                  isToggle={false}
                  onClick={() => onInsertTable(editor)}
                >
                  <Table2 className={iconClass} aria-hidden="true" />
                </ToolbarIconButton>
              )}
              {onInsertImage && (
                <ToolbarIconButton
                  label={t("editor.toolbar.insertImage")}
                  isToggle={false}
                  onClick={() => onInsertImage(editor)}
                >
                  <ImageIcon className={iconClass} aria-hidden="true" />
                </ToolbarIconButton>
              )}
              {extraInsertSlot}
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

/**
 * Plane's collapsible 52px desktop sticky formatting toolbar aligned to the
 * document column via CSS `@container` queries on `#page-toolbar-container`.
 */
export function PageStickyToolbar({
  editor,
  isEditable,
  isFullWidth,
  isStickyToolbarEnabled,
  onInsertTable,
  onInsertImage,
  extraInsertSlot,
  rightSlot,
}: PageStickyToolbarProps) {
  const shouldHideToolbar = !isStickyToolbarEnabled || !isEditable;

  return (
    <>
      <div
        id="page-toolbar-container"
        aria-hidden={shouldHideToolbar}
        className={cn(
          "shrink-0 border-b border-border/60 bg-background transition-all duration-300 ease-linear",
          shouldHideToolbar
            ? "max-h-0 overflow-hidden border-b-0"
            : "max-h-[52px] overflow-x-auto overflow-y-hidden",
        )}
      >
        <div
          className={cn(
            "page-toolbar-content hidden min-h-[52px] items-center justify-between pr-4 transition-all duration-200 ease-in-out md:flex",
            isFullWidth && "wide-layout",
          )}
        >
          <div className="min-w-0 flex-1">
            {editor && !shouldHideToolbar && (
              <PageStickyToolbarInner
                editor={editor}
                onInsertTable={onInsertTable}
                onInsertImage={onInsertImage}
                extraInsertSlot={extraInsertSlot}
              />
            )}
          </div>
          {rightSlot && (
            <div className="ml-2 flex shrink-0 items-center gap-1">
              {rightSlot}
            </div>
          )}
        </div>
      </div>

      {rightSlot && (
        <div
          className={cn(
            "absolute top-0 right-0 z-10 flex h-[52px] items-center px-4",
            !shouldHideToolbar && "md:hidden",
          )}
        >
          {rightSlot}
        </div>
      )}
    </>
  );
}
