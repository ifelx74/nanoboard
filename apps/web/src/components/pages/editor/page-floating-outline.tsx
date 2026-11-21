import { useTranslation } from "react-i18next";
import type { PageHeadingEntry } from "@/lib/pages/document";
import { cn } from "@/lib/utils";
import { PageOutlineList } from "./page-outline-list";

const BAR_WIDTH_CLASSES: Record<PageHeadingEntry["level"], string> = {
  1: "w-[20px]",
  2: "w-[18px]",
  3: "w-[14px]",
};

export interface PageFloatingOutlineProps {
  headings: readonly PageHeadingEntry[];
  onSelectHeading: (heading: PageHeadingEntry) => void;
  onOpenOutlinePane: () => void;
}

/**
 * Plane's floating right-edge horizontal-bar Outline strip (`20px`/`18px`/`14px`
 * bars for H1/H2/H3). Rendered inside `#page-content-container` when the right
 * navigation pane is closed and auto-hidden below `930px` container width via
 * CSS `@container` queries. Hovering expands a `w-52` clickable preview card,
 * and clicking the bar strip opens the slide-in right pane on the Outline tab.
 */
export function PageFloatingOutline({
  headings,
  onSelectHeading,
  onOpenOutlinePane,
}: PageFloatingOutlineProps) {
  const { t } = useTranslation("pages");

  if (headings.length === 0) {
    return null;
  }

  return (
    <div className="page-summary-container pointer-events-none absolute top-[64px] right-0 z-[5] h-[calc(100%-64px)]">
      <div className="group/page-toc pointer-events-auto sticky top-[72px] px-4">
        <button
          type="button"
          aria-label={t("outline.openPane")}
          onClick={(event) => {
            event.stopPropagation();
            onOpenOutlinePane();
          }}
          className="flex max-h-[50vh] cursor-pointer flex-col items-end gap-y-2 overflow-hidden py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {headings.map((heading, index) => (
            <span
              key={`${heading.id}-${index}`}
              aria-hidden="true"
              className={cn(
                "block h-0.5 shrink-0 rounded-xs bg-muted-foreground/40 transition-colors group-hover/page-toc:bg-muted-foreground/70",
                BAR_WIDTH_CLASSES[heading.level],
              )}
            />
          ))}
        </button>

        <nav
          aria-label={t("outline.previewAriaLabel")}
          className="pointer-events-none absolute top-0 right-0 z-20 max-h-[70vh] w-52 translate-x-1/2 overflow-y-auto rounded-sm border border-border bg-popover p-4 opacity-0 shadow-md transition-all duration-300 group-focus-within/page-toc:pointer-events-auto group-focus-within/page-toc:-translate-x-4 group-focus-within/page-toc:opacity-100 group-hover/page-toc:pointer-events-auto group-hover/page-toc:-translate-x-4 group-hover/page-toc:opacity-100"
        >
          <PageOutlineList
            headings={headings}
            onSelectHeading={onSelectHeading}
          />
        </nav>
      </div>
    </div>
  );
}
