import { Link } from "@tanstack/react-router";
import type { WhiteboardGalleryEntry } from "@/lib/db/whiteboard-previews";
import { getProjectIcon } from "@/lib/project-icons";

type GalleryCardProps = {
  entry: WhiteboardGalleryEntry;
};

/**
 * One gallery card: the board's stored thumbnail when one exists, otherwise
 * a neutral placeholder (muted surface with the project's icon — covering
 * legacy boards until their next autosave renders one). Below it, the
 * project icon and name as the title. The whole card is the link into that
 * project's whiteboard view; there are no other actions by design.
 */
export function GalleryCard({ entry }: GalleryCardProps) {
  const ProjectIcon = getProjectIcon(entry.projectIcon);

  return (
    <Link
      to="/project/$projectId/whiteboard"
      params={{ projectId: entry.projectId }}
      className="flex flex-col overflow-hidden rounded-lg border border-border outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {entry.dataUrl ? (
        // Thumbnails bake in the board's own background color, so they sit
        // on their own surface; contain keeps every element visible.
        <img
          src={entry.dataUrl}
          alt=""
          className="aspect-video w-full object-contain"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex aspect-video w-full items-center justify-center bg-muted"
        >
          <ProjectIcon className="size-8 text-muted-foreground" />
        </div>
      )}
      <div className="flex items-center gap-2 p-3">
        <ProjectIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {entry.projectName}
        </span>
      </div>
    </Link>
  );
}
