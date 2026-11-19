import { type RefObject, useEffect, useRef, useState } from "react";

/** How far beyond the scroll viewport rows mount, in pixels. */
const ROW_OVERSCAN_PX = 240;

/**
 * Lazy-mounts a Timeline row's contents when the row nears the scroll
 * viewport. The row wrapper itself always renders at the exact row pitch;
 * only the sidebar cell, chart cell, and bar mount. Once mounted, a row
 * stays mounted (unobserve on mount), so scrolling back never re-mounts and
 * an in-flight drag gesture on the bar is never torn out of the DOM.
 */
export function useLazyRowMount(
  rootRef: RefObject<HTMLDivElement | null>,
  options?: { initiallyMounted?: boolean },
): { rowRef: RefObject<HTMLDivElement | null>; mounted: boolean } {
  const rowRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(options?.initiallyMounted ?? false);

  useEffect(() => {
    if (mounted) return;
    const row = rowRef.current;
    if (!row) return;
    if (typeof IntersectionObserver === "undefined") {
      // Environments without IO (tests, very old browsers): mount everything.
      setMounted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setMounted(true);
          observer.disconnect();
          break;
        }
      },
      { root: rootRef.current, rootMargin: `${ROW_OVERSCAN_PX}px 0px` },
    );
    observer.observe(row);
    return () => observer.disconnect();
  }, [mounted, rootRef]);

  return { rowRef, mounted };
}
