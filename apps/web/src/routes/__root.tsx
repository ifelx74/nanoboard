import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Suspense } from "react";
import TanStackRouterDevtools from "@/tanstack/router";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return (
    <div className="flex h-svh w-full flex-col overflow-x-hidden overflow-y-auto bg-background">
      <Outlet />
      <Suspense fallback={null}>
        <TanStackRouterDevtools />
      </Suspense>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-4">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The page you are looking for does not exist.
      </p>
    </div>
  );
}
