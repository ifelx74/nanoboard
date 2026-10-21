import Layout from "@/components/common/layout";
import StickyHeader from "@/components/stickies/header";
import StickiesInfinite from "@/components/stickies/stickies-infinite";

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/stickies")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <StickyHeader />
      <Layout.Content>
        <StickiesInfinite />
      </Layout.Content>
    </>
  );
}
