import { useNavigate } from "@tanstack/react-router";
import { House, PencilRuler } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/empty";

/**
 * First-run dead end: the gallery is empty because whiteboards come into
 * existence by drawing inside a project — there is no create flow to point
 * at, so the message explains that and offers the way back Home.
 */
export function GalleryEmptyState() {
  const navigate = useNavigate();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12">
          <PencilRuler className="size-7" />
        </EmptyMedia>
        <EmptyTitle>Nothing on the whiteboard yet.</EmptyTitle>
        <EmptyDescription>
          Boards appear here once you draw something in a project&apos;s
          Whiteboard view.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button size="sm" onClick={() => navigate({ to: "/" })}>
          <House className="size-3.5" />
          <span>Back to Home</span>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
