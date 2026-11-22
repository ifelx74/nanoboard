import type { AnyExtension, Editor } from "@tiptap/core";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
  TableView,
} from "@tiptap/extension-table";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { columnResizing } from "@tiptap/pm/tables";
import type { EditorView } from "@tiptap/pm/view";

const DEFAULT_TABLE_ROWS = 3;
const DEFAULT_TABLE_COLS = 3;
const DEFAULT_CELL_MIN_WIDTH = 100;

/**
 * Thin `TableView` subclass adding Plane's `.editor-full-width-block` class
 * alongside `.tableWrapper` so wide tables break out horizontally across the
 * 720px / 1152px prose column and scroll cleanly.
 */
class PageTableView extends TableView {
  constructor(
    node: ProseMirrorNode,
    cellMinWidth: number,
    view?: EditorView,
    HTMLAttributes?: Record<string, unknown>,
  ) {
    super(node, cellMinWidth, view, HTMLAttributes);
    this.dom.className = "tableWrapper editor-full-width-block";
    this.syncIdAttr(node);
  }

  override update(node: ProseMirrorNode): boolean {
    const updated = super.update(node);
    if (updated) {
      this.syncIdAttr(node);
    }
    return updated;
  }

  private syncIdAttr(node: ProseMirrorNode): void {
    const id = node.attrs.id;
    if (typeof id === "string" && id.length > 0) {
      this.table.setAttribute("data-id", id);
    } else {
      this.table.removeAttribute("data-id");
    }
  }
}

/**
 * Standard TipTap v3 resizable Table extension configured for Pages:
 * - Always registers `columnResizing` when `resizable` is enabled (prosemirror-tables
 *   already guards all resize handlers with `view.editable`, so unlocking a
 *   initially locked page immediately enables column resizing without remount).
 * - Always wraps rendered tables in `.tableWrapper.editor-full-width-block`.
 * - Keeps standard TipTap node names (`table`, `tableRow`, `tableHeader`, `tableCell`)
 *   and attributes (`colspan`, `rowspan`, `colwidth`, `align`).
 */
export const PageTableExtension = Table.extend({
  addOptions() {
    const parentOptions = this.parent?.();
    return {
      HTMLAttributes: {},
      handleWidth: 5,
      allowTableNodeSelection: false,
      ...parentOptions,
      resizable: true,
      renderWrapper: true,
      cellMinWidth: DEFAULT_CELL_MIN_WIDTH,
      lastColumnResizable: true,
      View: PageTableView,
    };
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? [];
    // TipTap's base Table skips `columnResizing` when initially mounted read-only.
    // Registering it unconditionally lets unlocking a locked page enable column
    // resizing immediately while remaining inert when `view.editable` is false.
    if (this.options.resizable && !this.editor.isEditable) {
      return [
        columnResizing({
          handleWidth: this.options.handleWidth,
          cellMinWidth: this.options.cellMinWidth,
          defaultCellMinWidth: this.options.cellMinWidth,
          View: this.options.View,
          lastColumnResizable: this.options.lastColumnResizable,
        }),
        ...parentPlugins,
      ];
    }
    return parentPlugins;
  },

  addNodeView() {
    if (this.options.resizable) {
      return null;
    }
    return this.parent?.() ?? null;
  },
});

/**
 * Creates the standard TipTap v3 table extension set (`table`, `tableRow`,
 * `tableHeader`, `tableCell`) for Pages.
 */
export function createPageTableExtensions(): AnyExtension[] {
  return [PageTableExtension, TableRow, TableHeader, TableCell];
}

/**
 * Inserts a standard 3×3 table with a header row. When the caret is already
 * inside a table, inserts the new table cleanly right after the current table
 * rather than nesting tables.
 */
export function insertPageTable(editor: Editor): boolean {
  if (editor.isActive("table")) {
    const { $from } = editor.state.selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name === "table") {
        const afterTablePos = $from.after(depth);
        return editor
          .chain()
          .focus()
          .insertContentAt(afterTablePos, { type: "paragraph" })
          .setTextSelection(afterTablePos + 1)
          .insertTable({
            rows: DEFAULT_TABLE_ROWS,
            cols: DEFAULT_TABLE_COLS,
            withHeaderRow: true,
          })
          .run();
      }
    }
    return false;
  }

  return editor
    .chain()
    .focus()
    .insertTable({
      rows: DEFAULT_TABLE_ROWS,
      cols: DEFAULT_TABLE_COLS,
      withHeaderRow: true,
    })
    .run();
}

/**
 * Returns whether the first row of the currently focused table consists of
 * `tableHeader` (`<th>`) cells.
 */
export function hasActiveTableHeaderRow(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "table") {
      const firstRow = node.firstChild;
      if (!firstRow || firstRow.childCount === 0) return false;
      for (let i = 0; i < firstRow.childCount; i += 1) {
        if (firstRow.child(i).type.name !== "tableHeader") {
          return false;
        }
      }
      return true;
    }
  }
  return false;
}

/**
 * Resolves the active `<table>` DOM element enclosing the current selection,
 * used to anchor the contextual table controls bar.
 */
export function getActiveTableElement(editor: Editor): HTMLTableElement | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "table") {
      const tablePos = $from.before(depth);
      const domNode = editor.view.nodeDOM(tablePos);
      if (domNode instanceof HTMLTableElement) {
        return domNode;
      }
      if (domNode instanceof HTMLElement) {
        return domNode.querySelector("table");
      }
    }
  }
  return null;
}
