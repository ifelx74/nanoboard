import { resolveLabelColor } from "@/lib/label-color";
import type { Label } from "@/lib/db/schema";

/** Kaneo-exact board chips: color dot + name, sorted by name. */
export function TaskLabels({ labels }: { labels: Label[] }) {
  if (!labels.length) return null;

  // Kaneo sorts with a base-sensitivity numeric collator; match it so chip
  // order agrees with the reference app.
  const sortedLabels = [...labels].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
      numeric: true,
    }),
  );

  return (
    <div className="flex min-w-0 flex-wrap gap-x-2.5 gap-y-1">
      {sortedLabels.map((label) => (
        <span
          key={label.id}
          data-slot="task-label"
          className="flex max-w-full min-w-0 items-center gap-1.5 font-medium text-[10px] text-foreground/85"
        >
          <span
            aria-hidden="true"
            className="inline-block size-1.5 shrink-0 rounded-full"
            style={{
              backgroundColor: resolveLabelColor(label.color),
            }}
          />
          <span className="min-w-0 truncate" title={label.name}>
            {label.name}
          </span>
        </span>
      ))}
    </div>
  );
}
