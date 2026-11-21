import { createId } from "@paralleldrive/cuid2";
import { Extension, type AnyExtension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import UniqueID from "@tiptap/extension-unique-id";
import { CharacterCount } from "@tiptap/extensions";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { canJoin } from "@tiptap/pm/transform";
import StarterKit from "@tiptap/starter-kit";
import { i18n } from "@/lib/i18n";

const UNIQUE_ID_NODE_TYPES = [
  "heading",
  "paragraph",
  "blockquote",
  "bulletList",
  "orderedList",
  "taskList",
  "codeBlock",
  "horizontalRule",
];

const JOINABLE_LIST_TYPES = new Set(["bulletList", "orderedList", "taskList"]);

function collectAdjacentListJoinPositions(
  parent: ProseMirrorNode,
  contentStart: number,
  out: number[],
): void {
  let offset = 0;
  let prevTypeName: string | null = null;

  for (let index = 0; index < parent.childCount; index += 1) {
    const child = parent.child(index);
    const childPos = contentStart + offset;

    if (
      prevTypeName !== null &&
      prevTypeName === child.type.name &&
      JOINABLE_LIST_TYPES.has(child.type.name)
    ) {
      out.push(childPos);
    }

    if (!child.isTextblock && child.childCount > 0) {
      collectAdjacentListJoinPositions(child, childPos + 1, out);
    }

    prevTypeName = child.type.name;
    offset += child.nodeSize;
  }
}

/**
 * Exits a blockquote cleanly when pressing Enter on an empty paragraph inside
 * it or Backspace at the very beginning of its first block.
 */
const BlockquoteExitExtension = Extension.create({
  name: "pagesBlockquoteExit",
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        if (!this.editor.isActive("blockquote")) return false;
        const { selection } = this.editor.state;
        if (!selection.empty) return false;
        const { $from } = selection;
        if (
          $from.parent.type.name === "paragraph" &&
          $from.parent.content.size === 0
        ) {
          return this.editor.commands.lift("blockquote");
        }
        return false;
      },
      Backspace: () => {
        if (!this.editor.isActive("blockquote")) return false;
        const { selection } = this.editor.state;
        if (!selection.empty) return false;
        const { $from } = selection;
        if ($from.parentOffset !== 0) return false;
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          if ($from.node(depth).type.name === "blockquote") {
            if ($from.index(depth) === 0) {
              return this.editor.commands.lift("blockquote");
            }
            return false;
          }
        }
        return false;
      },
    };
  },
});

/**
 * List ergonomics for Pages: Tab / Shift-Tab indent and outdent across bullet,
 * ordered, and nested task lists without losing editor focus, plus automatic
 * joining of adjacent identical lists.
 */
const PagesListBehaviorExtension = Extension.create({
  name: "pagesListBehavior",

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("taskItem")) {
          this.editor.commands.sinkListItem("taskItem");
          return true;
        }
        if (this.editor.isActive("listItem")) {
          this.editor.commands.sinkListItem("listItem");
          return true;
        }
        return false;
      },
      "Shift-Tab": () => {
        if (this.editor.isActive("taskItem")) {
          this.editor.commands.liftListItem("taskItem");
          return true;
        }
        if (this.editor.isActive("listItem")) {
          this.editor.commands.liftListItem("listItem");
          return true;
        }
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("pagesListAutoJoin"),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const joinPositions: number[] = [];
          collectAdjacentListJoinPositions(newState.doc, 0, joinPositions);
          if (joinPositions.length === 0) return null;

          // Join right-to-left (highest pos first) so earlier positions remain valid.
          joinPositions.sort((a, b) => b - a);
          const tr = newState.tr;
          let joined = false;
          for (const pos of joinPositions) {
            if (canJoin(tr.doc, pos)) {
              tr.join(pos);
              joined = true;
            }
          }
          return joined ? tr : null;
        },
      }),
    ];
  },
});

/**
 * Bridges keyboard navigation from the start of the document body back up to
 * the Page H1 title input (ArrowUp, ArrowLeft, Backspace).
 */
function createTitleBodyNavigationExtension(
  onFocusTitleEnd: () => void,
): AnyExtension {
  return Extension.create({
    name: "pagesTitleBodyNavigation",
    priority: 1000,

    addKeyboardShortcuts() {
      return {
        ArrowUp: () => {
          const { state, view } = this.editor;
          const { selection } = state;
          if (!selection.empty) return false;
          const { $from } = selection;
          if (
            $from.depth === 1 &&
            $from.index(0) === 0 &&
            view.endOfTextblock("up")
          ) {
            onFocusTitleEnd();
            return true;
          }
          return false;
        },
        ArrowLeft: () => {
          const { selection } = this.editor.state;
          if (selection.empty && selection.from === 1) {
            onFocusTitleEnd();
            return true;
          }
          return false;
        },
        Backspace: () => {
          if (!this.editor.isEditable) return false;
          const { state, view } = this.editor;
          const { selection, doc } = state;
          if (!selection.empty || selection.from !== 1) return false;
          const firstChild = doc.firstChild;
          if (!firstChild) return false;
          if (
            firstChild.type.name === "paragraph" &&
            firstChild.content.size === 0 &&
            doc.childCount > 1
          ) {
            view.dispatch(state.tr.delete(0, firstChild.nodeSize));
            onFocusTitleEnd();
            return true;
          }
          if (
            firstChild.type.name === "paragraph" ||
            firstChild.type.name === "heading"
          ) {
            onFocusTitleEnd();
            return true;
          }
          return false;
        },
      };
    },
  });
}

export interface PagesEditorExtensionsOptions {
  editable: boolean;
  onFocusTitleEnd: () => void;
}

/**
 * Dedicated TipTap v3 starter extension set for Pages, completely isolated
 * from Task Description and Stickies editors. Loaded strictly inside the lazy
 * Page editor chunk.
 */
export function createPagesEditorExtensions({
  editable,
  onFocusTitleEnd,
}: PagesEditorExtensionsOptions): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Typography,
    Placeholder.configure({
      includeChildren: false,
      placeholder: ({ node }) => {
        if (node.type.name === "heading") {
          const level =
            typeof node.attrs.level === "number" ? node.attrs.level : 1;
          return i18n.t("pages:editor.headingPlaceholder", { level });
        }
        return i18n.t("pages:editor.placeholder");
      },
    }),
    CharacterCount,
    UniqueID.configure({
      attributeName: "id",
      types: UNIQUE_ID_NODE_TYPES,
      generateID: () => createId(),
      updateDocument: editable,
    }),
    BlockquoteExitExtension,
    PagesListBehaviorExtension,
    createTitleBodyNavigationExtension(onFocusTitleEnd),
  ];
}
