import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Suspense } from "react";
// import TanStackRouterDevtools from "@/tanstack/router";
import { Toaster } from "@/components/ui/toast";
import { NotFound } from "@/components/common/not-found";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return (
    <div className="flex h-svh w-full flex-row overflow-x-hidden overflow-y-hidden bg-background scrollbar-thin scrollbar-thumb-border scrollbar-track-muted">
      <Outlet />
      <Suspense fallback={null}>
        {/* <TanStackRouterDevtools /> */}
      </Suspense>
      <Toaster />
    </div>
  );
}
