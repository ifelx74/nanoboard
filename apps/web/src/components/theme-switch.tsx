import { MoonIcon, SunIcon } from "lucide-react";
import type * as React from "react";
import { revealEndRadius, shouldUseRevealTransition } from "@/lib/theme-reveal";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/theme";

type ViewTransition = {
  ready: Promise<void>;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransition;
};

/**
 * Binary moon/sun switch for the sidebar footer. Flips the persisted theme
 * store with a circular reveal expanding from the activation point; browsers
 * without view-transition support and users preferring reduced motion get an
 * instant swap. A native button keeps it keyboard-operable with visible focus.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDark = theme === "dark";

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const doc = document as ViewTransitionDocument;
    const supportsViewTransition =
      typeof doc.startViewTransition === "function";
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (
      !shouldUseRevealTransition(supportsViewTransition, prefersReducedMotion)
    ) {
      toggleTheme();
      return;
    }

    // Keyboard activation reports 0,0 — reveal from the control's center.
    const rect = event.currentTarget.getBoundingClientRect();
    const hasPointerCoords = event.clientX !== 0 || event.clientY !== 0;
    const x = hasPointerCoords
      ? event.clientX
      : rect.left + rect.width / 2;
    const y = hasPointerCoords ? event.clientY : rect.top + rect.height / 2;

    let transition: ViewTransition | undefined;
    try {
      transition = doc.startViewTransition?.(() => {
        toggleTheme();
      });
    } catch {
      transition = undefined;
    }
    if (!transition) {
      // startViewTransition missing, refused, or threw before running the
      // update: same instant swap as the unsupported path, exactly once.
      toggleTheme();
      return;
    }

    void transition.ready.then(
      () => {
        const endRadius = revealEndRadius(
          x,
          y,
          window.innerWidth,
          window.innerHeight,
        );
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 450,
            easing: "ease-out",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      },
      () => {
        // Aborted (e.g. superseded by a newer transition): the update already
        // flipped the store, so swallow to avoid an unhandled rejection.
      },
    );
  };

  return (
    <button
      aria-checked={isDark}
      aria-label={
        isDark
          ? "Switch to light theme (currently dark)"
          : "Switch to dark theme (currently light)"
      }
      className={cn(
        "relative inline-grid h-7 cursor-pointer grid-cols-[1fr_1fr] items-center rounded-full bg-input/50 font-medium text-sm outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      data-state={isDark ? "checked" : "unchecked"}
      onClick={handleClick}
      role="switch"
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0 left-0 h-full w-1/2 rounded-full bg-background shadow transition-transform duration-300 ease-out motion-reduce:transition-none",
          isDark ? "translate-x-0" : "translate-x-full",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none relative ms-0.5 flex min-w-7 items-center justify-center text-center",
          !isDark && "text-muted-foreground/70",
        )}
      >
        <MoonIcon size={13} />
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none relative me-0.5 flex min-w-7 items-center justify-center text-center",
          isDark && "text-muted-foreground/70",
        )}
      >
        <SunIcon size={13} />
      </span>
    </button>
  );
}
