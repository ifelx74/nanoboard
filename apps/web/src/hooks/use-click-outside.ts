import { useEffect, useRef, type RefObject } from "react";

/**
 * Calls `onOutside` when a `mousedown` lands outside `ref`'s element.
 * The callback lives in a ref so callers can pass inline lambdas without
 * re-subscribing the document listener on every render.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
) {
  const onOutsideRef = useRef(onOutside);
  useEffect(() => {
    onOutsideRef.current = onOutside;
  });

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutsideRef.current();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () =>
      document.removeEventListener("mousedown", handleMouseDown);
  }, [ref]);
}
