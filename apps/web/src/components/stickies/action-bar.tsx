import { useLocation } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, X } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useCreateSticky } from "@/hooks/use-create-sticky";
import Stickies from "@/icons/stickies";
import { getStickies } from "@/lib/db/stickies";
import { cn } from "@/lib/utils";
import { stickyBackgroundColor } from "./color-palette";

// The action bar renders on every authenticated page, so the card and modal
// (which pull in tiptap/ProseMirror) load lazily on first use instead of
// shipping with the app shell.
const StickyCard = lazy(() =>
  import("./sticky-card").then((m) => ({ default: m.StickyCard })),
);
const AllStickiesModal = lazy(() =>
  import("./all-stickies-modal").then((m) => ({
    default: m.AllStickiesModal,
  })),
);

export function StickyActionBar() {
  const location = useLocation();
  const stickies = useLiveQuery(() => getStickies(), []);
  const { addSticky } = useCreateSticky();

  const [isExpanded, setIsExpanded] = useState(false);
  const [activePopupStickyId, setActivePopupStickyId] = useState<string | null>(
    null,
  );
  const [allStickiesOpen, setAllStickiesOpen] = useState(false);
  // Latched on first open so the lazy modal chunk loads on demand but the
  // dialog then stays mounted (keeping its open/close animations).
  const [hasOpenedModal, setHasOpenedModal] = useState(false);
  const [recentPreviewOpen, setRecentPreviewOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-hide when on the dedicated stickies page
  const isStickiesPage = location.pathname.startsWith("/stickies");

  const recentSticky = stickies && stickies.length > 0 ? stickies[0] : null;

  const recentStickyBackgroundColor = recentSticky
    ? stickyBackgroundColor(recentSticky.backgroundColor)
    : undefined;

  useClickOutside(containerRef, () => {
    setIsExpanded(false);
    setActivePopupStickyId(null);
  });

  if (isStickiesPage) return null;

  const handleQuickAdd = async () => {
    const result = await addSticky();
    if (result.ok) {
      setActivePopupStickyId(result.sticky.id);
      setIsExpanded(false);
    } else if (result.reason === "empty-exists" && recentSticky) {
      setActivePopupStickyId(recentSticky.id);
      setIsExpanded(false);
    }
  };

  const activePopupSticky = stickies?.find(
    (s) => s.id === activePopupStickyId,
  );

  return (
    <>
      <div
        ref={containerRef}
        className="fixed right-6 bottom-6 z-40 flex flex-col items-end"
      >
        {/* Floating Quick Sticky Note Popup matching Plane's w-[290px] */}
        {activePopupSticky && (
          <div className="absolute right-0 bottom-14 z-50 mb-2 w-72.5 animate-in fade-in zoom-in-95 duration-200">
            <Suspense fallback={null}>
              <StickyCard
                sticky={activePopupSticky}
                onClose={() => setActivePopupStickyId(null)}
                className="shadow-xl"
              />
            </Suspense>
          </div>
        )}

        <TooltipProvider>
          {/* Expanded Action Menu */}
          <div
            className={cn(
              "mb-2 flex origin-bottom flex-col gap-2 transition-all duration-300 ease-in-out",
              isExpanded
                ? "scale-y-100 opacity-100"
                : "pointer-events-none h-0 scale-y-0 opacity-0",
            )}
          >
            {/* All stickies button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="All stickies"
                  onClick={() => {
                    setHasOpenedModal(true);
                    setAllStickiesOpen(true);
                    setIsExpanded(false);
                  }}
                  className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus:outline-none"
                >
                  <Stickies className="size-4 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs">All stickies</p>
              </TooltipContent>
            </Tooltip>

            {/* Recent sticky button (with preview popover) */}
            {recentSticky && (
              <Popover
                open={recentPreviewOpen && isExpanded}
                onOpenChange={setRecentPreviewOpen}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Recent sticky"
                        onMouseEnter={() => setRecentPreviewOpen(true)}
                        onMouseLeave={() => setRecentPreviewOpen(false)}
                        onClick={() => {
                          setActivePopupStickyId(recentSticky.id);
                          setIsExpanded(false);
                        }}
                        className="flex size-10 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-colors hover:bg-muted focus:outline-none"
                      >
                        <div
                          className="size-3.5 rounded-xs"
                          style={{
                            backgroundColor: recentStickyBackgroundColor,
                          }}
                        />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p className="text-xs">Recent sticky</p>
                  </TooltipContent>
                </Tooltip>

                <PopoverContent
                  side="left"
                  align="center"
                  className="w-64 overflow-hidden p-0 shadow-lg pointer-events-none"
                >
                  <div className="relative max-h-35 overflow-hidden p-3 text-xs">
                    <div
                      className="font-medium line-clamp-4"
                      dangerouslySetInnerHTML={{
                        __html:
                          recentSticky.contentHtml ||
                          "<p class='italic text-muted-foreground'>Empty sticky note</p>",
                      }}
                    />
                    <div
                      className="absolute inset-0 bg-linear-to-t from-background/90 via-transparent to-transparent pointer-events-none"
                    />
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Add sticky button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Add sticky"
                  onClick={handleQuickAdd}
                  className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus:outline-none"
                >
                  <Plus className="size-4.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs">Add sticky</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Main FAB Toggle Button */}
          <button
            type="button"
            aria-label="Toggle stickies menu"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-all duration-300 hover:bg-muted focus:outline-none",
              isExpanded && "rotate-180 bg-muted",
            )}
          >
            {isExpanded ? (
              <X className="size-4" />
            ) : (
              <Stickies className="size-4.5 shrink-0" />
            )}
          </button>
        </TooltipProvider>
      </div>

      {/* All Stickies Modal */}
      {hasOpenedModal && (
        <Suspense fallback={null}>
          <AllStickiesModal
            open={allStickiesOpen}
            onOpenChange={setAllStickiesOpen}
            stickies={stickies ?? []}
          />
        </Suspense>
      )}
    </>
  );
}
