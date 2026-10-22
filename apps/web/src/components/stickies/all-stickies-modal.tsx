import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Stickies from "@/icons/stickies";
import type { Sticky } from "@/lib/db/schema";
import { createSticky } from "@/lib/db/stickies";
import { toast } from "@/lib/toast";
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
  const [isCreating, setIsCreating] = useState(false);

  const filteredStickies = stickies.filter((sticky) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const textContent = sticky.contentHtml.replace(/<[^>]*>/g, " ");
    return textContent.toLowerCase().includes(query);
  });

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Stickies className="size-4 shrink-0 text-muted-foreground" />
            <span>Your stickies</span>
          </DialogTitle>

          <div className="flex items-center gap-2 pr-6">
            <StickySearch value={searchQuery} onChange={setSearchQuery} />
            <Button
              size="sm"
              onClick={handleAddSticky}
              disabled={isCreating}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>Add sticky</span>
            </Button>
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
            <MasonryGrid itemIds={filteredStickies.map((s) => s.id)}>
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
