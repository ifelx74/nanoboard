import { PencilRuler } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Layout from "../common/layout";

/**
 * The gallery's title-only header: sidebar toggle, then the page identity.
 * No search, no create button — the gallery is a pure launcher (whiteboards
 * come into existence by drawing inside a project).
 */
export function GalleryHeader() {
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
            <PencilRuler className="size-4 shrink-0" />
            <span className="text-sm font-semibold text-card-foreground">
              Whiteboard
            </span>
          </div>
        </div>
      </div>
    </Layout.Header>
  );
}
