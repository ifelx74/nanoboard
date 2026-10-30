import { useNavigate } from "@tanstack/react-router";
import { House, PencilRuler } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * First-run dead end: the gallery is empty because whiteboards come into
 * existence by drawing inside a project — there is no create flow to point
 * at, so the message explains that and offers the way back Home.
 */
export function GalleryEmptyState() {
  const navigate = useNavigate();

  return (
    <div className="flex size-full flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-xs">
        <PencilRuler className="size-7" />
      </div>
      <h3 className="mb-2 max-w-md font-heading font-semibold text-base text-foreground sm:text-lg">
        Nothing on the whiteboard yet.
      </h3>
      <p className="mb-6 max-w-sm text-muted-foreground text-xs leading-relaxed sm:text-sm">
        Boards appear here once you draw something in a project&apos;s
        Whiteboard view.
      </p>
      <Button size="sm" onClick={() => navigate({ to: "/" })}>
        <House className="size-3.5" />
        <span>Back to Home</span>
      </Button>
    </div>
  );
}
