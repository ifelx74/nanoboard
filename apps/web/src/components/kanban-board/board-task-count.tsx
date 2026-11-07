import { useTranslation } from "react-i18next";

export function BoardTaskCount({
  shown,
  total,
  className,
}: {
  shown: number;
  total: number;
  className?: string;
}) {
  const { t } = useTranslation("board");
  return (
    <span
      aria-live="polite"
      className={
        className ?? "truncate text-xs text-muted-foreground tabular-nums"
      }
    >
      {shown === total
        ? t("taskCount", { count: total })
        : t("taskCountShown", { shown, total })}
    </span>
  );
}
