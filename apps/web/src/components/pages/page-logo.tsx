import { FileText } from "lucide-react";
import type { PageLogo } from "@/lib/db/schema";
import { getProjectIcon } from "@/lib/project-icons";
import { cn } from "@/lib/utils";

type PageLogoIconProps = {
  logo: PageLogo | null;
  className?: string;
  emojiClassName?: string;
};

/**
 * Renders a Page's chosen emoji or colored Lucide icon, falling back to a
 * subtle `FileText` glyph when no logo is set.
 */
export function PageLogoIcon({
  logo,
  className,
  emojiClassName,
}: PageLogoIconProps) {
  if (logo?.type === "emoji") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center justify-center leading-none",
          emojiClassName ?? "size-4 text-sm",
        )}
      >
        {logo.value}
      </span>
    );
  }

  if (logo?.type === "icon") {
    const Icon = getProjectIcon(logo.name);
    return (
      <Icon
        aria-hidden="true"
        className={cn("size-4 shrink-0", className)}
        style={{ color: logo.color }}
      />
    );
  }

  return (
    <FileText
      aria-hidden="true"
      className={cn("size-4 shrink-0 text-muted-foreground", className)}
    />
  );
}
