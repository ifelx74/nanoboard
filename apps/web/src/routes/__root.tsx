import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Suspense } from "react";
// import TanStackRouterDevtools from "@/tanstack/router";
import { ErrorFallback } from "@/components/common/error-fallback";
import { NotFound } from "@/components/common/not-found";

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: ErrorFallback,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return (
    <div className="flex h-svh w-full flex-row overflow-x-hidden overflow-y-hidden bg-background scrollbar-thin scrollbar-thumb-border scrollbar-track-muted">
      <Outlet />
      <Suspense fallback={null}>{/* <TanStackRouterDevtools /> */}</Suspense>
    </div>
  );
}
