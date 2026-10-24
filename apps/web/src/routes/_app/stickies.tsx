import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import Layout from "@/components/common/layout";
import { StickyHeader } from "@/components/stickies/header";
import { StickiesLayout } from "@/components/stickies/stickies-layout";
import { useCreateSticky } from "@/hooks/use-create-sticky";
import { getStickies } from "@/lib/db/stickies";

export const Route = createFileRoute("/_app/stickies")({
  component: RouteComponent,
});

function RouteComponent() {
  const stickies = useLiveQuery(() => getStickies(), []);
  const [searchQuery, setSearchQuery] = useState("");
  const { isCreating, addSticky } = useCreateSticky();

  const handleAddSticky = async () => {
    const result = await addSticky();
    if (result.ok) setSearchQuery("");
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
