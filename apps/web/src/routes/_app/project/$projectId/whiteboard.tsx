import { ProjectLayout } from "@/components/common/project-layout";
import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";

// The Excalidraw editor is heavy; lazy-loading keeps it out of every other
// route's bundle. All its runtime imports live inside the chunk.
const WhiteboardCanvas = lazy(
  () => import("@/components/whiteboard/whiteboard-canvas"),
);

export const Route = createFileRoute("/_app/project/$projectId/whiteboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  return (
    <ProjectLayout projectId={projectId} activeView="whiteboard">
      <Suspense fallback={null}>
        {/* Remount per project: TanStack Router reuses the component across
            param changes, and a stale scene must never render — let alone
            autosave — under the next project's id. */}
        <WhiteboardCanvas key={projectId} projectId={projectId} />
      </Suspense>
    </ProjectLayout>
  );
}
