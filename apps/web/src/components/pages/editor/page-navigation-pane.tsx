import {
  CircleArrowRight,
  Download,
  ImageOff,
  Images,
  ListTree,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Page } from "@/lib/db/schema";
import { getActiveLocale } from "@/lib/format";
import type {
  PageDocumentStats,
  PageHeadingEntry,
  PageImageEntry,
} from "@/lib/pages/document";
import { downloadPageImage } from "@/lib/pages/image-download";
import { cn } from "@/lib/utils";
import {
  useOptionalPageAssetUrlCache,
  usePageAssetUrl,
} from "./page-asset-url-context";
import { PageOutlineList } from "./page-outline-list";

export type PageNavigationPaneTab = "outline" | "info" | "assets";

const PANE_TABS: readonly PageNavigationPaneTab[] = [
  "outline",
  "info",
  "assets",
];

export interface PageNavigationPaneProps {
  page: Page;
  activeTab: PageNavigationPaneTab | undefined;
  headings: readonly PageHeadingEntry[];
  stats: PageDocumentStats;
  images: readonly PageImageEntry[];
  onTabChange: (tab: PageNavigationPaneTab | undefined) => void;
  onSelectHeading: (heading: PageHeadingEntry) => void;
  onSelectImage: (image: PageImageEntry, index: number) => void;
}

function formatDateTime(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function PageAssetCard({
  image,
  index,
  onSelect,
}: {
  image: PageImageEntry;
  index: number;
  onSelect: (image: PageImageEntry, index: number) => void;
}) {
  const { t } = useTranslation("pages");
  const cache = useOptionalPageAssetUrlCache();
  const localAsset = usePageAssetUrl(image.assetId);
  const [externalError, setExternalError] = useState(false);

  const displayName = image.name || t("rightPane.assets.untitledImage");
  const resolvedSrc = image.assetId ? localAsset.url : image.src;
  const isLoading = Boolean(image.assetId && localAsset.loading);
  const isBroken = Boolean(
    (image.assetId && localAsset.missing) ||
    (!image.assetId && (!image.src || externalError)),
  );

  return (
    <div className="group/asset-card relative flex h-12 items-center gap-2 rounded-sm border border-border bg-card pr-2 transition-colors hover:bg-accent/50">
      <button
        type="button"
        aria-label={t("rightPane.assets.jumpToImage", { name: displayName })}
        onClick={() => onSelect(image, index)}
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-l-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex h-full w-11 shrink-0 items-center justify-center overflow-hidden rounded-l-sm bg-muted text-muted-foreground">
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : isBroken || !resolvedSrc ? (
            <ImageOff className="size-3.5" aria-hidden="true" />
          ) : (
            <img
              src={resolvedSrc}
              alt={image.alt || displayName}
              loading="lazy"
              onError={() => {
                if (!image.assetId) {
                  setExternalError(true);
                }
              }}
              className="size-full object-cover"
            />
          )}
        </div>
        <span
          title={displayName}
          className="min-w-0 flex-1 truncate text-xs font-medium text-foreground"
        >
          {displayName}
        </span>
      </button>

      {!isLoading && !isBroken && resolvedSrc && (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={t("rightPane.assets.download")}
                onClick={(event) => {
                  event.stopPropagation();
                  void downloadPageImage(cache, {
                    assetId: image.assetId,
                    src: image.src,
                    name: displayName,
                  });
                }}
                className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-xs text-muted-foreground opacity-0 transition-all outline-none group-hover/asset-card:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Download className="size-3.5" aria-hidden="true" />
              </button>
            }
          />
          <TooltipContent side="left">
            {t("rightPane.assets.download")}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * Plane's `294px` slide-in right navigation pane synced to
 * `?paneTab=outline|info|assets`. Uses negative right margin transitions so
 * the sibling editor column resizes smoothly via CSS `@container` queries.
 */
export function PageNavigationPane({
  page,
  activeTab,
  headings,
  stats,
  images,
  onTabChange,
  onSelectHeading,
  onSelectImage,
}: PageNavigationPaneProps) {
  const { t } = useTranslation("pages");
  const isOpen = activeTab !== undefined;

  // Retain the last visible tab while sliding closed so the exit transition
  // never flashes an empty panel.
  const [renderedTab, setRenderedTab] = useState<PageNavigationPaneTab>(
    activeTab ?? "outline",
  );
  useEffect(() => {
    if (activeTab) {
      setRenderedTab(activeTab);
    }
  }, [activeTab]);

  const locale = getActiveLocale();
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale),
    [locale],
  );

  const formattedReadTime =
    stats.readTimeSeconds < 60
      ? t("rightPane.info.readTimeSeconds", { count: stats.readTimeSeconds })
      : t("rightPane.info.readTimeMinutes", { count: stats.readTimeMinutes });

  const tabLabels: Record<PageNavigationPaneTab, string> = {
    outline: t("rightPane.tabs.outline"),
    info: t("rightPane.tabs.info"),
    assets: t("rightPane.tabs.assets"),
  };

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = PANE_TABS[(currentIndex + 1) % PANE_TABS.length];
      onTabChange(next);
      document.getElementById(`page-pane-tab-${next}`)?.focus();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prev =
        PANE_TABS[(currentIndex - 1 + PANE_TABS.length) % PANE_TABS.length];
      onTabChange(prev);
      document.getElementById(`page-pane-tab-${prev}`)?.focus();
    }
  }

  return (
    <TooltipProvider delay={300}>
      <aside
        aria-label={t("rightPane.ariaLabel")}
        aria-hidden={!isOpen}
        inert={!isOpen || undefined}
        style={{ marginRight: isOpen ? "0px" : "-294px" }}
        className="flex h-full w-[294px] shrink-0 flex-col overflow-hidden border-l border-border bg-background pt-3.5 transition-[margin-right] duration-300 ease-out"
      >
        <div className="mb-3.5 flex shrink-0 items-center px-3.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={t("rightPane.close")}
                  onClick={() => onTabChange(undefined)}
                  className="grid size-6 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CircleArrowRight className="size-4" aria-hidden="true" />
                </button>
              }
            />
            <TooltipContent side="left">{t("rightPane.close")}</TooltipContent>
          </Tooltip>
        </div>

        <div
          role="tablist"
          aria-label={t("rightPane.tabsAriaLabel")}
          className="mx-3.5 mb-3 grid shrink-0 grid-cols-3 rounded-md border border-border/60 bg-muted/60 p-0.5"
        >
          {PANE_TABS.map((tab, index) => {
            const isSelected = renderedTab === tab;
            return (
              <button
                key={tab}
                id={`page-pane-tab-${tab}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`page-pane-panel-${tab}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onTabChange(tab)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={cn(
                  "cursor-pointer truncate rounded-sm px-2 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tabLabels[tab]}
              </button>
            );
          })}
        </div>

        <div
          id={`page-pane-panel-${renderedTab}`}
          role="tabpanel"
          aria-labelledby={`page-pane-tab-${renderedTab}`}
          className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-6"
        >
          {renderedTab === "outline" &&
            (headings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/70 px-4 py-10 text-center">
                <ListTree
                  className="mb-2 size-5 text-muted-foreground/70"
                  aria-hidden="true"
                />
                <p className="text-xs font-medium text-foreground">
                  {t("outline.emptyTitle")}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {t("outline.emptyDescription")}
                </p>
              </div>
            ) : (
              <PageOutlineList
                headings={headings}
                onSelectHeading={onSelectHeading}
              />
            ))}

          {renderedTab === "info" && (
            <div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-sm bg-muted/50 p-2.5">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {numberFormatter.format(stats.words)}
                  </p>
                  <p className="mt-1.5 text-[13px] font-medium text-muted-foreground">
                    {t("rightPane.info.words")}
                  </p>
                </div>

                <div className="rounded-sm bg-muted/50 p-2.5">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {numberFormatter.format(stats.characters)}
                  </p>
                  <p className="mt-1.5 text-[13px] font-medium text-muted-foreground">
                    {t("rightPane.info.characters")}
                  </p>
                </div>

                <div className="rounded-sm bg-muted/50 p-2.5">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {numberFormatter.format(stats.paragraphs)}
                  </p>
                  <p className="mt-1.5 text-[13px] font-medium text-muted-foreground">
                    {t("rightPane.info.paragraphs")}
                  </p>
                </div>

                <div className="rounded-sm bg-muted/50 p-2.5">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formattedReadTime}
                  </p>
                  <p className="mt-1.5 text-[13px] font-medium text-muted-foreground">
                    {t("rightPane.info.readTime")}
                  </p>
                </div>
              </div>

              <dl className="mt-4 space-y-3 border-t border-border/60 pt-4">
                <div>
                  <dt className="text-[11px] font-medium text-muted-foreground">
                    {t("rightPane.info.updated")}
                  </dt>
                  <dd className="mt-0.5 text-xs font-medium text-foreground">
                    {formatDateTime(page.updatedAt, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium text-muted-foreground">
                    {t("rightPane.info.created")}
                  </dt>
                  <dd className="mt-0.5 text-xs font-medium text-foreground">
                    {formatDateTime(page.createdAt, locale)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {renderedTab === "assets" &&
            (images.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/70 px-4 py-10 text-center">
                <Images
                  className="mb-2 size-5 text-muted-foreground/70"
                  aria-hidden="true"
                />
                <p className="text-xs font-medium text-foreground">
                  {t("rightPane.assets.emptyTitle")}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {t("rightPane.assets.emptyDescription")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {images.map((image, index) => (
                  <PageAssetCard
                    key={`${image.id}-${image.assetId ?? ""}-${image.src ?? ""}-${index}`}
                    image={image}
                    index={index}
                    onSelect={onSelectImage}
                  />
                ))}
              </div>
            ))}
        </div>
      </aside>
    </TooltipProvider>
  );
}
