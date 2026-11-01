import { SearchX } from "lucide-react";
import Stickies from "@/icons/stickies";
import { AddStickyButton } from "./add-sticky-button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/empty";

type EmptyStickiesProps = {
  onAddSticky: () => void;
  isCreating?: boolean;
};

export function EmptyStickiesState({
  onAddSticky,
  isCreating = false,
}: EmptyStickiesProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12">
          <Stickies className="size-7" />
        </EmptyMedia>
        <EmptyTitle>Capture your thoughts and ideas with stickies.</EmptyTitle>
        <EmptyDescription>
          Create stickies for quick notes and to-dos, and keep them with you
          wherever you go.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <AddStickyButton onClick={onAddSticky} isCreating={isCreating} />
      </EmptyContent>
    </Empty>
  );
}

type EmptySearchProps = {
  onAddSticky: () => void;
  isCreating?: boolean;
};

export function EmptySearchState({
  onAddSticky,
  isCreating = false,
}: EmptySearchProps) {
  return (
    <div className="flex size-full flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </div>
      <h3 className="mb-1.5 font-heading font-semibold text-base text-foreground">
        That doesn't match any of your stickies.
      </h3>
      <p className="mb-5 max-w-xs text-muted-foreground text-xs leading-relaxed sm:text-sm">
        Try a different term or let us know if you are sure your search is
        right.
      </p>
      <AddStickyButton onClick={onAddSticky} isCreating={isCreating} />
    </div>
  );
}
