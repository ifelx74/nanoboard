import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import Layout from "@/components/common/layout";
import StickyHeader from "@/components/stickies/header";
import { StickiesLayout } from "@/components/stickies/stickies-layout";
import { createSticky, getStickies } from "@/lib/db/stickies";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_app/stickies")({
  component: RouteComponent,
});

function RouteComponent() {
  const stickies = useLiveQuery(() => getStickies(), []);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleAddSticky = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await createSticky();
      toast.success("Sticky created");
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === "ALREADY_EXISTS_EMPTY"
      ) {
        toast.warning("There already exists a sticky with no description");
      } else {
        toast.error("Failed to create sticky");
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <StickyHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddSticky={handleAddSticky}
        isCreating={isCreating}
      />
      <Layout.Content>
        <div className="h-full overflow-y-auto p-4 sm:p-6">
          <StickiesLayout
            stickies={stickies ?? []}
            searchQuery={searchQuery}
            onAddSticky={handleAddSticky}
            isCreating={isCreating}
          />
        </div>
      </Layout.Content>
    </>
  );
}
