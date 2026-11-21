/**
 * Lightweight Suspense / loading fallback for the lazy-loaded Page detail
 * editor workspace. Matches the centered 720px document column so hydration
 * does not shift layout.
 */
export function PageEditorSkeleton() {
  return (
    <div
      className="h-full overflow-y-auto bg-background"
      aria-hidden="true"
    >
      <div className="mx-auto max-w-[720px] space-y-6 px-5 pt-12 pb-24 sm:px-8">
        <div className="h-9 w-2/5 animate-pulse rounded-md bg-muted" />
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
