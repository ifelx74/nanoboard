import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Minus,
  PanelTop,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isCellSelection } from "@/lib/pages/editor-commands";
import {
  getActiveTableElement,
  hasActiveTableHeaderRow,
} from "@/lib/pages/extensions/table-extension";
import { cn } from "@/lib/utils";
import { usePageEditorEditable } from "./page-editor-context";
import "./pages-table.css";

const TABLE_TOOLBAR_PLUGIN_KEY = "pagesTableToolbar";

export interface PageTableToolbarProps {
  editor: Editor;
  scrollTarget?: HTMLElement | null;
}

function TableActionButton({
  label,
  active,
  disabled,
  destructive,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            aria-label={label}
            aria-pressed={active !== undefined ? active : undefined}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
            className={cn(
              "inline-flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-sm px-1.5 text-xs font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
              destructive
                ? "hover:bg-destructive/10 hover:text-destructive"
                : "hover:bg-accent hover:text-foreground",
              active && "bg-accent text-foreground",
            )}
          >
            {children}
          </button>
        }
      />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Compact contextual table controls bar rendered when the caret or cell
 * selection is focused inside an editable table. Exposes only v1 standard
 * table actions: add/delete row, add/delete column, toggle header row, and
 * delete table. Never shown when the page is locked or archived.
 */
export function PageTableToolbar({
  editor,
  scrollTarget,
}: PageTableToolbarProps) {
  const { t } = useTranslation("pages");
  const isEditable = usePageEditorEditable(editor);

  const tableState = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e.isActive("table")) {
        return {
          inTable: false,
          hasHeaderRow: false,
          canAddRowBefore: false,
          canAddRowAfter: false,
          canDeleteRow: false,
          canAddColumnBefore: false,
          canAddColumnAfter: false,
          canDeleteColumn: false,
          canToggleHeaderRow: false,
          canDeleteTable: false,
        };
      }
      return {
        inTable: true,
        hasHeaderRow: hasActiveTableHeaderRow(e),
        canAddRowBefore: e.can().addRowBefore(),
        canAddRowAfter: e.can().addRowAfter(),
        canDeleteRow: e.can().deleteRow(),
        canAddColumnBefore: e.can().addColumnBefore(),
        canAddColumnAfter: e.can().addColumnAfter(),
        canDeleteColumn: e.can().deleteColumn(),
        canToggleHeaderRow: e.can().toggleHeaderRow(),
        canDeleteTable: e.can().deleteTable(),
      };
    },
  });

  const iconClass = "size-3.5";

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={TABLE_TOOLBAR_PLUGIN_KEY}
      updateDelay={80}
      shouldShow={({ editor: e, state }) => {
        if (!isEditable || !e.isEditable || !e.isActive("table")) return false;
        const { selection } = state;
        // Let PageBubbleMenu take over during non-empty text selections so two
        // floating bars never collide over the same cell.
        return selection.empty || isCellSelection(selection);
      }}
      getReferencedVirtualElement={() => {
        const tableEl = getActiveTableElement(editor);
        if (!tableEl) return null;
        return {
          getBoundingClientRect: () => {
            const rect = tableEl.getBoundingClientRect();
            const wrapper = tableEl.closest(".tableWrapper");
            if (!wrapper) return rect;
            const wrapperRect = wrapper.getBoundingClientRect();
            const left = Math.max(rect.left, wrapperRect.left);
            const right = Math.min(rect.right, wrapperRect.right);
            return new DOMRect(
              left,
              rect.top,
              Math.max(0, right - left),
              rect.height,
            );
          },
        };
      }}
      options={{
        placement: "top-start",
        offset: 8,
        flip: true,
        shift: { padding: 8 },
        scrollTarget: scrollTarget ?? undefined,
      }}
    >
      {isEditable && tableState.inTable && (
        <TooltipProvider delay={300}>
          <div
            role="toolbar"
            aria-label={t("table.toolbarAriaLabel")}
            className="flex max-w-[92vw] items-center divide-x divide-border overflow-x-auto rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-md"
          >
            {/* Rows: add above, add below, delete */}
            <div className="flex items-center gap-0.5 px-1.5">
              <span className="px-1 text-[11px] font-medium text-muted-foreground select-none">
                {t("table.rowGroup")}
              </span>
              <TableActionButton
                label={t("table.addRowBefore")}
                disabled={!tableState.canAddRowBefore}
                onClick={() => editor.chain().focus().addRowBefore().run()}
              >
                <BetweenHorizontalStart
                  className={iconClass}
                  aria-hidden="true"
                />
              </TableActionButton>
              <TableActionButton
                label={t("table.addRowAfter")}
                disabled={!tableState.canAddRowAfter}
                onClick={() => editor.chain().focus().addRowAfter().run()}
              >
                <BetweenHorizontalEnd
                  className={iconClass}
                  aria-hidden="true"
                />
              </TableActionButton>
              <TableActionButton
                label={t("table.deleteRow")}
                disabled={!tableState.canDeleteRow}
                destructive
                onClick={() => editor.chain().focus().deleteRow().run()}
              >
                <Minus className={iconClass} aria-hidden="true" />
              </TableActionButton>
            </div>

            {/* Columns: add before, add after, delete */}
            <div className="flex items-center gap-0.5 px-1.5">
              <span className="px-1 text-[11px] font-medium text-muted-foreground select-none">
                {t("table.columnGroup")}
              </span>
              <TableActionButton
                label={t("table.addColumnBefore")}
                disabled={!tableState.canAddColumnBefore}
                onClick={() => editor.chain().focus().addColumnBefore().run()}
              >
                <BetweenVerticalStart
                  className={iconClass}
                  aria-hidden="true"
                />
              </TableActionButton>
              <TableActionButton
                label={t("table.addColumnAfter")}
                disabled={!tableState.canAddColumnAfter}
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              >
                <BetweenVerticalEnd className={iconClass} aria-hidden="true" />
              </TableActionButton>
              <TableActionButton
                label={t("table.deleteColumn")}
                disabled={!tableState.canDeleteColumn}
                destructive
                onClick={() => editor.chain().focus().deleteColumn().run()}
              >
                <Minus className={iconClass} aria-hidden="true" />
              </TableActionButton>
            </div>

            {/* Header row toggle */}
            <div className="flex items-center px-1.5">
              <TableActionButton
                label={t("table.toggleHeaderRow")}
                active={tableState.hasHeaderRow}
                disabled={!tableState.canToggleHeaderRow}
                onClick={() => editor.chain().focus().toggleHeaderRow().run()}
              >
                <PanelTop className={iconClass} aria-hidden="true" />
                <span>{t("table.headerRow")}</span>
              </TableActionButton>
            </div>

            {/* Delete table */}
            <div className="flex items-center px-1.5">
              <TableActionButton
                label={t("table.deleteTable")}
                disabled={!tableState.canDeleteTable}
                destructive
                onClick={() => editor.chain().focus().deleteTable().run()}
              >
                <Trash2 className={iconClass} aria-hidden="true" />
              </TableActionButton>
            </div>
          </div>
        </TooltipProvider>
      )}
    </BubbleMenu>
  );
}
