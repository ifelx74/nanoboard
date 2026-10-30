import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Stickies from "@/icons/stickies";
import { SidebarTriggerHeader } from "../common/sidebar-trigger-header";
import Layout from "../common/layout";
import { StickySearch } from "./sticky-search";

type Props = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddSticky: () => void;
  isCreating: boolean;
};

export function StickyHeader({
  searchQuery,
  onSearchChange,
  onAddSticky,
  isCreating,
}: Props) {
  return (
    <Layout.Header>
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-1">
          <SidebarTriggerHeader />
          <div className="flex items-center gap-1.5">
            <Stickies className="size-4 shrink-0" />
            <span className="text-sm font-semibold text-card-foreground">
              Stickies
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StickySearch value={searchQuery} onChange={onSearchChange} />
          <Button onClick={onAddSticky} disabled={isCreating}>
            {isCreating && <Loader2 className="size-3.5 animate-spin" />}
            <span>Add sticky</span>
          </Button>
        </div>
      </div>
    </Layout.Header>
  );
}
