import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Stickies from "@/icons/stickies";
import Layout from "../common/layout";
import { StickySearch } from "./sticky-search";

type Props = {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onAddSticky?: () => void;
  isCreating?: boolean;
};

export default function StickyHeader({
  searchQuery = "",
  onSearchChange,
  onAddSticky,
  isCreating = false,
}: Props) {
  return (
    <Layout.Header>
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="-ml-1 size-6" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-[10px]">Toggle sidebar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="mx-1.5 h-4 w-px shrink-0 bg-border/80" />
          <div className="flex items-center gap-1.5">
            <Stickies className="size-4 shrink-0" />
            <span className="text-sm font-semibold text-card-foreground">
              Stickies
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSearchChange && (
            <StickySearch value={searchQuery} onChange={onSearchChange} />
          )}
          {onAddSticky && (
            <Button
              size="sm"
              onClick={onAddSticky}
              disabled={isCreating}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>Add sticky</span>
            </Button>
          )}
        </div>
      </div>
    </Layout.Header>
  );
}
