import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/project/$projectId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/project/$projectId/board",
      params: { projectId: params.projectId },
    });
  },
});
