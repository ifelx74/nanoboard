import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateSticky } from "@/hooks/use-create-sticky";
import Stickies from "@/icons/stickies";
import type { Sticky } from "@/lib/db/schema";
import { stickySearchIndex } from "@/lib/db/stickies";
import { AddStickyButton } from "./add-sticky-button";
import { EmptySearchState, EmptyStickiesState } from "./empty-states";
import { MasonryGrid, MasonryItem } from "./masonry";
import { StickyCard } from "./sticky-card";
import { StickySearch } from "./sticky-search";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stickies: Sticky[];
};

export function AllStickiesModal({ open, onOpenChange, stickies }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const { isCreating, addSticky } = useCreateSticky();

  const searchIndex = useMemo(() => stickySearchIndex(stickies), [stickies]);

  const filteredStickies = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return stickies;
    return stickies.filter((sticky) =>
      searchIndex.get(sticky.id)?.includes(query),
    );
  }, [stickies, searchIndex, searchQuery]);

  const filteredIds = useMemo(
    () => filteredStickies.map((sticky) => sticky.id),
    [filteredStickies],
  );

  const handleAddSticky = async () => {
    const result = await addSticky();
    if (result.ok) setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Stickies className="size-4 shrink-0 text-muted-foreground" />
            <span>Your stickies</span>
          </DialogTitle>

          <div className="flex items-center gap-2 pr-6">
            <StickySearch value={searchQuery} onChange={setSearchQuery} />
            <AddStickyButton
              onClick={handleAddSticky}
              isCreating={isCreating}
            />
          </div>
        </DialogHeader>

        <div className="max-h-[625px] overflow-y-auto p-6">
          {stickies.length === 0 ? (
            <EmptyStickiesState
              onAddSticky={handleAddSticky}
              isCreating={isCreating}
            />
          ) : filteredStickies.length === 0 && searchQuery.trim() !== "" ? (
            <EmptySearchState
              onAddSticky={handleAddSticky}
              isCreating={isCreating}
            />
          ) : (
            <MasonryGrid itemIds={filteredIds}>
              {filteredStickies.map((sticky) => (
                <MasonryItem key={sticky.id} id={sticky.id}>
                  <StickyCard sticky={sticky} />
                </MasonryItem>
              ))}
            </MasonryGrid>
          )}
        </div>

        <div className="border-t border-border bg-muted/30 px-6 py-2.5 text-center">
          <Link
            to="/stickies"
            onClick={() => onOpenChange(false)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Show all stickies &rarr;
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
