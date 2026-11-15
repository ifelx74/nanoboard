import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";
import { Suspense } from "react";
// import TanStackRouterDevtools from "@/tanstack/router";
import { ErrorFallback } from "@/components/common/error-fallback";
import { NotFound } from "@/components/common/not-found";
import { i18n } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: ErrorFallback,
  notFoundComponent: NotFound,
  head: () => {
    const title = i18n.t("seo:defaultTitle");
    const description = i18n.t("seo:defaultDescription");
    return pageMeta(title, description);
  },
});

function RootComponent() {
  return (
    <div className="flex h-svh w-full flex-row overflow-x-hidden overflow-y-hidden bg-background scrollbar-thin scrollbar-thumb-border scrollbar-track-muted">
      <HeadContent />
      <Outlet />
      <Suspense fallback={null}>{/* <TanStackRouterDevtools /> */}</Suspense>
    </div>
  );
}
