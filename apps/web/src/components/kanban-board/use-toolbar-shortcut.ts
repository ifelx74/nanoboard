import { useEffect, useRef } from "react";

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  // SELECT is not text entry: shortcuts stay available on focused selects.
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  // Popups carry no dialog/menu role (Base UI popover, tooltip), so match
  // their slots directly alongside the roles.
  return (
    target.closest(
      '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="combobox"], [data-slot="popover-popup"], [data-slot="tooltip-popup"]',
    ) !== null
  );
}

/**
 * Single-key toolbar shortcut (e.g. `/` for search, `f` for filter).
 * Ignored while typing, with modifiers held, or inside dialogs and menus.
 */
export function useToolbarShortcut(key: string, onPress: () => void) {
  const handler = useRef(onPress);
  useEffect(() => {
    handler.current = onPress;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== key) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTextEntry(event.target)) return;
      event.preventDefault();
      handler.current();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key]);
}
