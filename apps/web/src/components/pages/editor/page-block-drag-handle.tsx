import type { JSONContent } from "@tiptap/core";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { usePageEditorEditable } from "./page-editor-context";

const DRAG_HANDLE_POSITION_CONFIG = {
  placement: "left-start" as const,
  strategy: "absolute" as const,
};

interface HoveredBlockTarget {
  node: ProseMirrorNode;
  pos: number;
}

/**
 * Recursively strips `attrs.id` from a cloned ProseMirror JSON block so
 * `UniqueID` allocates fresh unique identifiers when duplicating a block.
 */
function stripIdsRecursively(content: JSONContent): JSONContent {
  const next: JSONContent = { ...content };
  if (next.attrs && "id" in next.attrs) {
    const restAttrs = { ...next.attrs };
    delete restAttrs.id;
    next.attrs = restAttrs;
  }
  if (Array.isArray(next.content)) {
    next.content = next.content.map(stripIdsRecursively);
  }
  return next;
}

export interface PageBlockDragHandleProps {
  editor: Editor;
}

/**
 * Plane's left-gutter 6-dot Block Drag Handle + click/right-click Block Menu
 * (`Delete`, `Duplicate`). Mounted only when the page is editable so locked
 * and archived pages never expose drag or block-mutation controls.
 */
export function PageBlockDragHandle({ editor }: PageBlockDragHandleProps) {
  const { t } = useTranslation("pages");
  const isEditable = usePageEditorEditable(editor);
  const handleButtonRef = useRef<HTMLButtonElement | null>(null);
  const hoveredRef = useRef<HoveredBlockTarget | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<HoveredBlockTarget | null>(null);

  const setDragHandleLocked = useCallback(
    (locked: boolean) => {
      if (editor.isDestroyed) return;
      editor.view.dispatch(editor.state.tr.setMeta("lockDragHandle", locked));
    },
    [editor],
  );

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuTarget(null);
    setDragHandleLocked(false);
  }, [setDragHandleLocked]);

  useEffect(() => {
    if (!isEditable && menuOpen) {
      closeMenu();
    }
  }, [isEditable, menuOpen, closeMenu]);

  const handleOpenBlockMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (!isEditable) return;
      const target = hoveredRef.current;
      if (!target || editor.isDestroyed) return;

      // Select the targeted block node so Plane's blue block-selection highlight
      // visibly frames the block being acted on.
      try {
        const { state, view } = editor;
        if (target.pos >= 0 && target.pos < state.doc.content.size) {
          const selection = NodeSelection.create(state.doc, target.pos);
          view.dispatch(state.tr.setSelection(selection));
        }
      } catch {
        // Non-selectable nodes still open the block menu cleanly using stored pos.
      }

      setMenuTarget(target);
      setMenuOpen(true);
      setDragHandleLocked(true);
    },
    [editor, isEditable, setDragHandleLocked],
  );

  const handleDeleteBlock = useCallback(() => {
    const target = menuTarget;
    if (!isEditable || !target || editor.isDestroyed) {
      closeMenu();
      return;
    }

    const { state } = editor;
    const nodeAtPos = state.doc.nodeAt(target.pos);
    if (nodeAtPos) {
      editor
        .chain()
        .focus()
        .deleteRange({
          from: target.pos,
          to: target.pos + nodeAtPos.nodeSize,
        })
        .run();
    } else {
      editor.chain().focus().deleteSelection().run();
    }
    closeMenu();
  }, [menuTarget, isEditable, editor, closeMenu]);

  const handleDuplicateBlock = useCallback(() => {
    const target = menuTarget;
    if (!isEditable || !target || editor.isDestroyed) {
      closeMenu();
      return;
    }

    const { state } = editor;
    const nodeAtPos = state.doc.nodeAt(target.pos);
    if (!nodeAtPos) {
      closeMenu();
      return;
    }

    const insertPos = target.pos + nodeAtPos.nodeSize;
    const clonedJson = stripIdsRecursively(nodeAtPos.toJSON() as JSONContent);
    const nextFocusPos = Math.min(insertPos + 1, state.doc.content.size);

    editor
      .chain()
      .insertContentAt(insertPos, clonedJson, { updateSelection: true })
      .focus(nextFocusPos, { scrollIntoView: false })
      .run();
    closeMenu();
  }, [menuTarget, isEditable, editor, closeMenu]);

  if (!isEditable) {
    return null;
  }

  const isDuplicateDisabled =
    menuTarget?.node.type.name === "image" ||
    menuTarget?.node.type.name === "pageImage";

  return (
    <>
      <DragHandle
        editor={editor}
        className="nb-drag-handle z-20 pr-1.5"
        computePositionConfig={DRAG_HANDLE_POSITION_CONFIG}
        onNodeChange={({ node, pos }) => {
          if (node && pos >= 0) {
            hoveredRef.current = { node, pos };
          } else {
            hoveredRef.current = null;
          }
        }}
        onElementDragStart={() => {
          closeMenu();
          if (!editor.isDestroyed) {
            editor.view.dom.classList.add("dragging");
          }
        }}
        onElementDragEnd={() => {
          if (!editor.isDestroyed) {
            editor.view.dom.classList.remove("dragging");
          }
        }}
      >
        <button
          ref={handleButtonRef}
          type="button"
          aria-label={t("editor.blockMenu.handleAriaLabel")}
          title={t("editor.blockMenu.handleTooltip")}
          onClick={handleOpenBlockMenu}
          onContextMenu={handleOpenBlockMenu}
          className="hidden size-6 cursor-grab items-center justify-center rounded-xs text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing sm:flex"
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
      </DragHandle>

      <Popover
        open={menuOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeMenu();
          }
        }}
      >
        <PopoverContent
          anchor={handleButtonRef}
          side="left"
          align="start"
          sideOffset={6}
          className="min-w-[8rem] p-1"
        >
          <div
            role="menu"
            aria-label={t("editor.blockMenu.ariaLabel")}
            className="flex flex-col gap-0.5"
          >
            <button
              type="button"
              role="menuitem"
              onClick={handleDeleteBlock}
              className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{t("editor.blockMenu.delete")}</span>
            </button>
            {!isDuplicateDisabled && (
              <button
                type="button"
                role="menuitem"
                onClick={handleDuplicateBlock}
                className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Copy className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{t("editor.blockMenu.duplicate")}</span>
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
