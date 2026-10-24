import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 *  lays its stickies out with `react-masonry-component`: every note is
 * absolutely positioned and dropped into the currently shortest column, so the
 * top row reads left-to-right and the columns keep ragged bottoms.
 *
 * Two details matter for a faithful mapping:
 *
 * 1. The column count is derived from the *container* width, not the viewport.
 * 2. Every cell is padded by 8px, which produces the 16px visual gutter
 *    between two neighbouring notes.
 *
 * This module reproduces both without depending on the unmaintained
 * `react-masonry-component` package.
 */
const MASONRY_CELL_PADDING = 8;

export function getMasonryColumnCount(width: number | null): number {
  if (width === null) return 4;
  if (width < 480) return 1;
  if (width < 850) return 2;
  if (width < 1024) return 3;
  if (width < 1280) return 4;
  if (width < 1536) return 5;
  return 6;
}

type MasonryPosition = { left: number; top: number; width: number };

type MasonryContextValue = {
  positions: Map<string, MasonryPosition>;
  registerHeight: (id: string, height: number) => void;
};

const MasonryContext = createContext<MasonryContextValue | null>(null);

function useMasonryContext() {
  const context = useContext(MasonryContext);
  if (!context) {
    throw new Error("MasonryItem must be rendered inside a MasonryGrid");
  }
  return context;
}

type MasonryGridProps = {
  /** Ids in display order — the masonry packs them into the shortest column. */
  itemIds: string[];
  children: ReactNode;
  className?: string;
};

export function MasonryGrid({
  itemIds,
  children,
  className,
}: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [hasLaidOut, setHasLaidOut] = useState(false);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);
    setWidth(element.clientWidth);

    return () => observer.disconnect();
  }, []);

  const registerHeight = useCallback((id: string, height: number) => {
    setHeights((previous) => {
      const current = previous[id];
      if (current !== undefined && Math.abs(current - height) < 1) {
        return previous;
      }
      return { ...previous, [id]: height };
    });
  }, []);

  const columnCount = getMasonryColumnCount(width);
  const columnWidth = width !== null && width > 0 ? width / columnCount : 0;

  const { positions, containerHeight } = useMemo(() => {
    const positions = new Map<string, MasonryPosition>();
    if (columnWidth === 0) return { positions, containerHeight: 0 };

    const columnHeights = new Array<number>(columnCount).fill(0);
    for (const id of itemIds) {
      let column = 0;
      for (let candidate = 1; candidate < columnCount; candidate += 1) {
        if (columnHeights[candidate] < columnHeights[column])
          column = candidate;
      }
      const top = columnHeights[column];
      positions.set(id, {
        left: column * columnWidth,
        top,
        width: columnWidth,
      });
      columnHeights[column] = top + (heights[id] ?? 0);
    }

    return { positions, containerHeight: Math.max(...columnHeights, 0) };
  }, [columnCount, columnWidth, heights, itemIds]);

  // Reveal the grid once every note has been measured, so the first paint
  // already shows the final layout instead of a pile of overlapping notes.
  useEffect(() => {
    if (hasLaidOut || itemIds.length === 0) return;
    if (itemIds.every((id) => heights[id] !== undefined)) setHasLaidOut(true);
  }, [hasLaidOut, heights, itemIds]);

  const context = useMemo(
    () => ({ positions, registerHeight }),
    [positions, registerHeight],
  );

  return (
    <MasonryContext.Provider value={context}>
      <div
        ref={containerRef}
        className={cn(
          "relative w-full transition-opacity duration-300 ease-in-out",
          hasLaidOut ? "opacity-100" : "opacity-0",
          className,
        )}
        style={{ height: containerHeight }}
      >
        {columnWidth > 0 ? children : null}
      </div>
    </MasonryContext.Provider>
  );
}

type MasonryItemProps = {
  /** Must match the id handed to `MasonryGrid`. */
  id: string;
  className?: string;
  style?: CSSProperties;
  /** Lets a drag-and-drop library claim the cell as its measured node. */
  itemRef?: (element: HTMLDivElement | null) => void;
  children: ReactNode;
};

export function MasonryItem({
  id,
  className,
  style,
  itemRef,
  children,
}: MasonryItemProps) {
  const { positions, registerHeight } = useMasonryContext();
  const position = positions.get(id);
  const elementRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const measure = () => registerHeight(id, element.offsetHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();

    return () => observer.disconnect();
  }, [id, registerHeight]);

  const setRef = useCallback(
    (element: HTMLDivElement | null) => {
      elementRef.current = element;
      itemRef?.(element);
    },
    [itemRef],
  );

  // The masonry offset rides on `transform` (compositor-friendly — animating
  // left/top would trigger layout for every card on each reorder frame) and
  // composes with any drag transform passed in through `style`.
  const masonryTransform = position
    ? `translate3d(${position.left}px, ${position.top}px, 0)`
    : undefined;
  const dragTransform =
    typeof style?.transform === "string" ? style.transform : undefined;
  const transform =
    dragTransform !== undefined
      ? `${masonryTransform ?? ""} ${dragTransform}`.trim()
      : masonryTransform;

  return (
    <div
      ref={setRef}
      className={cn(
        "box-border flex flex-col transition-transform duration-300 ease-out",
        className,
      )}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: position?.width ?? 0,
        padding: MASONRY_CELL_PADDING,
        ...style,
        transform,
      }}
    >
      {children}
    </div>
  );
}
