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
            <div className="flex items-center justify-center h-full">
              <GalleryEmptyState />
            </div>
          ) : (
            <div className="@container mx-auto w-full px-6 py-10 lg:px-10">
              <h1 className="text-xl font-semibold mb-3">Recently modified</h1>
              <div className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3 @4xl:grid-cols-4 @6xl:grid-cols-5">
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
