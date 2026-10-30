import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import Layout from "@/components/common/layout";
import { GalleryCard } from "@/components/whiteboard/gallery-card";
import { GalleryEmptyState } from "@/components/whiteboard/gallery-empty-state";
import { GalleryHeader } from "@/components/whiteboard/gallery-header";
import { db } from "@/lib/db/db";
import { listWhiteboardGallery } from "@/lib/db/whiteboard-previews";

export const Route = createFileRoute("/_app/whiteboard")({
  component: RouteComponent,
});

function RouteComponent() {
  // One live query over the preview index joined with projects: edits move
  // and refresh cards, deletions and renames update in place — all without
  // navigation. The listing never reads scene rows, and nothing on this
  // route imports the whiteboard editor chunk.
  const entries = useLiveQuery(() => listWhiteboardGallery(db), []);
  // While the first query run is still pending (entries === undefined) render
  // nothing: falling through to the empty state here would flash "Nothing on
  // the whiteboard yet" on every gallery visit before real entries arrive.
  const list = entries ?? [];

  return (
    <>
      <GalleryHeader />
      <Layout.Content>
        <div className="h-full overflow-y-auto">
          {entries === undefined ? null : list.length === 0 ? (
            <GalleryEmptyState />
          ) : (
            <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-10">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((entry) => (
                  <GalleryCard key={entry.projectId} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </div>
      </Layout.Content>
    </>
  );
}
