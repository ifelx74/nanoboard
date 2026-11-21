import type { Editor } from "@tiptap/core";
import type { Selection } from "@tiptap/pm/state";
import { normalizeLinkHref } from "@/lib/pages/links";

export type PageTextAlignment = "left" | "center" | "right";

/**
 * Checks whether a ProseMirror selection is a TipTap Table `CellSelection`
 * without pulling `@tiptap/pm/tables` into Ticket 03.
 */
export function isCellSelection(selection: Selection): boolean {
  return (
    "$anchorCell" in selection &&
    "$headCell" in selection &&
    selection.constructor.name === "CellSelection"
  );
}

/**
 * Plane's smart Code toggle:
 * - Inside a code block → exits back to paragraphs.
 * - Empty selection → toggles a fenced code block.
 * - Multi-line selection → replaces with a fenced code block preserving text.
 * - Single-line selection → toggles inline code mark.
 */
export function toggleSmartCode(editor: Editor): void {
  if (editor.isActive("codeBlock")) {
    editor.chain().focus().toggleCodeBlock().run();
    return;
  }

  const { selection, doc } = editor.state;
  if (selection.empty) {
    editor.chain().focus().toggleCodeBlock().run();
    return;
  }

  const text = doc.textBetween(selection.from, selection.to, "\n");
  if (text.includes("\n")) {
    editor
      .chain()
      .focus()
      .deleteRange({ from: selection.from, to: selection.to })
      .insertContentAt(selection.from, {
        type: "codeBlock",
        content: [{ type: "text", text }],
      })
      .run();
    return;
  }

  editor.chain().focus().toggleCode().run();
}

/**
 * Applies a validated link URL to a specific range (optionally updating the
 * display text while preserving all non-link marks). Returns `false` if the
 * URL fails safe-protocol validation.
 */
export function updateLinkRange(
  editor: Editor,
  range: { from: number; to: number },
  rawUrl: string,
  nextText?: string,
): boolean {
  const normalizedUrl = normalizeLinkHref(rawUrl);
  if (!normalizedUrl) return false;

  const { state, view } = editor;
  const linkMarkType = state.schema.marks.link;
  if (!linkMarkType) return false;

  const docSize = state.doc.content.size;
  const from = Math.max(0, Math.min(range.from, docSize));
  const to = Math.max(from, Math.min(range.to, docSize));
  if (from === to) return false;

  const trimmedText = nextText?.trim();
  const currentText = state.doc.textBetween(from, to);

  if (trimmedText && trimmedText !== currentText) {
    const firstNode = state.doc.nodeAt(from);
    const preservedMarks = (firstNode?.marks ?? []).filter(
      (mark) => mark.type !== linkMarkType,
    );
    const nextLinkMark = linkMarkType.create({ href: normalizedUrl });
    const replacementNode = state.schema.text(trimmedText, [
      ...preservedMarks,
      nextLinkMark,
    ]);
    const tr = state.tr.replaceWith(from, to, replacementNode);
    view.dispatch(tr);
    return true;
  }

  const tr = state.tr
    .removeMark(from, to, linkMarkType)
    .addMark(from, to, linkMarkType.create({ href: normalizedUrl }));
  view.dispatch(tr);
  return true;
}

/**
 * Finds the contiguous range `[from, to]` of a `link` mark covering `pos`
 * within the same parent textblock, even when bold/italic/color marks split
 * the anchor across multiple text nodes.
 */
export function findLinkMarkRange(
  editor: Editor,
  pos: number,
  targetHref: string,
): { from: number; to: number; text: string } | null {
  const { doc } = editor.state;
  const linkType = editor.state.schema.marks.link;
  if (!linkType || pos < 0 || pos > doc.content.size) return null;

  const $pos = doc.resolve(pos);
  const parent = $pos.parent;
  const parentStart = $pos.start();

  let offset = 0;
  let rangeFrom = -1;
  let rangeTo = -1;

  for (let i = 0; i < parent.childCount; i += 1) {
    const child = parent.child(i);
    const childStart = parentStart + offset;
    const childEnd = childStart + child.nodeSize;
    offset += child.nodeSize;

    const hasMatchingLink =
      child.isText &&
      child.marks.some(
        (mark) => mark.type === linkType && mark.attrs.href === targetHref,
      );

    if (hasMatchingLink) {
      if (rangeFrom === -1) {
        rangeFrom = childStart;
        rangeTo = childEnd;
      } else if (rangeTo === childStart) {
        rangeTo = childEnd;
      } else if (pos >= rangeFrom && pos <= rangeTo) {
        break;
      } else {
        rangeFrom = childStart;
        rangeTo = childEnd;
      }
    } else if (rangeFrom !== -1 && pos >= rangeFrom && pos <= rangeTo) {
      break;
    } else {
      rangeFrom = -1;
      rangeTo = -1;
    }
  }

  if (rangeFrom === -1 || rangeTo === -1 || pos < rangeFrom || pos > rangeTo) {
    return null;
  }

  return {
    from: rangeFrom,
    to: rangeTo,
    text: doc.textBetween(rangeFrom, rangeTo),
  };
}
