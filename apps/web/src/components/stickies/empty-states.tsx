import { Plus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import Stickies from "@/icons/stickies";

type EmptyStickiesProps = {
  onAddSticky: () => void;
  isCreating?: boolean;
};

export function EmptyStickiesState({
  onAddSticky,
  isCreating = false,
}: EmptyStickiesProps) {
  return (
    <div className="flex size-full flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-xs">
        <Stickies className="size-7" />
      </div>
      <h3 className="mb-2 max-w-md font-heading font-semibold text-base text-foreground sm:text-lg">
        Stickies are quick notes and to-dos you take down on the fly.
      </h3>
      <p className="mb-6 max-w-sm text-muted-foreground text-xs leading-relaxed sm:text-sm">
        Capture your thoughts and ideas effortlessly by creating stickies that
        you can access anytime and from anywhere.
      </p>
      <Button
        onClick={onAddSticky}
        disabled={isCreating}
        size="sm"
        className="gap-1.5"
      >
        <Plus className="size-3.5" />
        <span>Add sticky</span>
      </Button>
    </div>
  );
}

type EmptySearchProps = {
  onClearSearch: () => void;
};

export function EmptySearchState({ onClearSearch }: EmptySearchProps) {
  return (
    <div className="flex size-full flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </div>
      <h3 className="mb-1.5 font-heading font-semibold text-base text-foreground">
        That doesn't match any of your stickies.
      </h3>
      <p className="mb-5 max-w-xs text-muted-foreground text-xs leading-relaxed sm:text-sm">
        Try a different search term or clear the filter to see all your stickies.
      </p>
      <Button variant="outline" size="sm" onClick={onClearSearch}>
        Clear search
      </Button>
    </div>
  );
}
