import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the whiteboard slot, shared by the route's Suspense
 * fallback (chunk load) and the canvas's hydration window (scene read).
 * Deliberately abstract — no toolbar-shaped hint that could flash wrong.
 */
export function WhiteboardSkeleton() {
  return (
    <div className="flex h-full w-full flex-col gap-4 p-6" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32 rounded-lg" />
        <Skeleton className="h-6 w-24 rounded-lg" />
      </div>
      <Skeleton className="h-full w-full flex-1 rounded-lg" />
    </div>
  );
}
