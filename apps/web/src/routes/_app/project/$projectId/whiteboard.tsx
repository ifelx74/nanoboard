import { ProjectLayout } from "@/components/common/project-layout";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/project/$projectId/whiteboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  return (
    <ProjectLayout projectId={projectId} activeView="whiteboard">
      <div>Hello "/_app/project/$projectId/whiteboard"!</div>
    </ProjectLayout>
  );
}
