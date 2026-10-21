import { createFileRoute, Outlet } from "@tanstack/react-router";
import Layout from "@/components/common/layout";
import { StickyActionBar } from "@/components/stickies/action-bar";

// Pathless shell layout: sidebar + inset content for all app routes.
export const Route = createFileRoute("/_app")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Layout>
      <Outlet />
      <StickyActionBar />
    </Layout>
  );
}
