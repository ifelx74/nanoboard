import type { PageHeadingEntry, PageImageEntry } from "@/lib/pages/document";
import { getPageImageAnchorId } from "@/lib/pages/extensions/image-node";
import { cn } from "@/lib/utils";

const HEADING_LEVEL_CLASSES: Record<PageHeadingEntry["level"], string> = {
  1: "pl-1 text-[13px]",
  2: "pl-2.5 text-[11px]",
  3: "pl-4 text-[11px]",
};

function escapeSelectorAttr(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}

/**
 * Smooth-scrolls the Page document container to the heading matching `heading`.
 * Looks up UniqueID's rendered `data-id` attribute first, then element `#id`,
 * then falls back to H1–H3 DOM order for read-only documents without stored IDs.
 */
export function scrollToPageHeading(
  containerEl: HTMLElement | null,
  heading: PageHeadingEntry,
): void {
  const scope: ParentNode = containerEl ?? document;
  const escapedId = escapeSelectorAttr(heading.id);

  let target =
    scope.querySelector<HTMLElement>(`[data-id="${escapedId}"]`) ??
    document.getElementById(heading.id);

  if (!target) {
    const fallbackMatch = /^heading-(\d+)$/.exec(heading.id);
    if (fallbackMatch) {
      const idx = Number.parseInt(fallbackMatch[1], 10);
      const headings = scope.querySelectorAll<HTMLElement>(
        ".nb-page-editor .tiptap h1, .nb-page-editor .tiptap h2, .nb-page-editor .tiptap h3",
      );
      target = headings[idx] ?? null;
    }
  }

  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Smooth-scrolls the Page document container to the image block matching `image`.
 * Uses Ticket 06's canonical `#image-<nodeId>` anchor first, falling back to
 * `data-id` or rendered `page-image` DOM order for legacy/read-only nodes.
 */
export function scrollToPageImage(
  containerEl: HTMLElement | null,
  image: PageImageEntry,
  imageIndex: number,
): void {
  const scope: ParentNode = containerEl ?? document;
  const anchorId =
    image.anchorId ??
    (image.id.startsWith("image-node-")
      ? null
      : getPageImageAnchorId(image.id));

  let target: HTMLElement | null = anchorId
    ? document.getElementById(anchorId)
    : null;

  if (!target && !image.id.startsWith("image-node-")) {
    const escapedId = escapeSelectorAttr(image.id);
    target = scope.querySelector<HTMLElement>(`[data-id="${escapedId}"]`);
  }

  if (!target) {
    const imageBlocks = scope.querySelectorAll<HTMLElement>(
      '[data-type="page-image"]',
    );
    target = imageBlocks[imageIndex] ?? null;
  }

  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export interface PageOutlineListProps {
  headings: readonly PageHeadingEntry[];
  onSelectHeading: (heading: PageHeadingEntry) => void;
  className?: string;
}

/**
 * Shared clickable H1–H3 outline list rendered in both the floating outline
 * hover preview card and the right navigation pane's Outline tab.
 */
export function PageOutlineList({
  headings,
  onSelectHeading,
  className,
}: PageOutlineListProps) {
  return (
    <ul className={cn("flex flex-col gap-0.5", className)}>
      {headings.map((heading, index) => (
        <li key={`${heading.id}-${index}`} className="min-w-0">
          <button
            type="button"
            title={heading.text}
            onClick={(event) => {
              event.stopPropagation();
              onSelectHeading(heading);
            }}
            className={cn(
              "block w-full cursor-pointer truncate rounded-xs py-1 pr-1 text-left font-medium text-muted-foreground transition-colors outline-none hover:text-brand-800 focus-visible:text-brand-800 focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-brand-300 dark:focus-visible:text-brand-300",
              HEADING_LEVEL_CLASSES[heading.level],
            )}
          >
            {heading.text}
          </button>
        </li>
      ))}
    </ul>
  );
}
