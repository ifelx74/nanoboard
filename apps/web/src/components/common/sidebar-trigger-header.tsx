import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SidebarTriggerHeaderProps = {
  /** Class for the SidebarTrigger itself; every header wants `-ml-1` plus a 6-unit square. */
  triggerClassName?: string;
};

/**
 * The shared leading block of every app header: the sidebar toggle (with its
 * tooltip) followed by the divider that separates it from the page identity.
 */
export function SidebarTriggerHeader({
  triggerClassName = "-ml-1 size-6",
}: SidebarTriggerHeaderProps) {
  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarTrigger className={triggerClassName} />
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-[10px]">Toggle sidebar</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div className="mx-1.5 h-4 w-px shrink-0 bg-border/80" />
    </>
  );
}
