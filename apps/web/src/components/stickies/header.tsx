import React from "react";
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

export default function StickyHeader() {
  return (
    <Layout.Header>
      <div className="flex w-full items-center justify-between">
        <div className="flex w-full items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="-ml-1 h-6 w-6" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-[10px]">Toggle sidebar</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="mx-1.5 h-4 w-px shrink-0 bg-border/80" />
          <div className="flex items-center gap-1">
            <Stickies className="mr-1 inline h-4 w-4" />
            <span className="text-sm font-semibold text-card-foreground">
              Stickies
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size={"sm"}>Add sticky</Button>
        </div>
      </div>
    </Layout.Header>
  );
}
