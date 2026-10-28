import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  control?: React.ReactNode;
  description?: React.ReactNode;
  title?: React.ReactNode;
};

export function SettingsHeading(props: Props) {
  const { className, control, description, title } = props;

  return (
    <div
      className={cn(
        "flex flex-col items-start justify-between gap-4 md:flex-row md:items-center",
        className,
      )}
    >
      <div className="flex flex-col items-start gap-1">
        {title && <h6 className="font-medium text-primary">{title}</h6>}
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {control}
    </div>
  );
}
