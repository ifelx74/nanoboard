import type { Editor } from "@tiptap/core";
import { createContext, useContext } from "react";

/**
 * Provides reactive editability state to React NodeViews mounted inside
 * `PageEditorWorkspace`, since `editor.setEditable(..., false)` suppresses
 * TipTap `"update"` events on lock/unlock transitions.
 */
export const PageEditorEditableContext = createContext<boolean | null>(null);

export function usePageEditorEditable(editor: Editor): boolean {
  const fromContext = useContext(PageEditorEditableContext);
  return fromContext ?? editor.isEditable;
}
