export function BoardTaskCount({
  shown,
  total,
  className,
}: {
  shown: number;
  total: number;
  className?: string;
}) {
  const units = total === 1 ? "task" : "tasks";
  return (
    <span
      className={
        className ?? "hidden truncate text-xs text-muted-foreground tabular-nums sm:inline"
      }
    >
      {shown === total
        ? `${total} ${units}`
        : `${shown} of ${total} shown`}
    </span>
  );
}
