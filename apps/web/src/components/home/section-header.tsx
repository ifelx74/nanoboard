import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  detail?: ReactNode;
  action?: ReactNode;
};

export function SectionHeader({ title, detail, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2.5">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        {detail && (
          <span className="truncate text-[13px] text-muted-foreground">
            {detail}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}
