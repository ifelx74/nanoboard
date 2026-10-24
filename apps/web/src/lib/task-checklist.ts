export interface ChecklistStats {
  done: number;
  total: number;
}

const ITEM_PATTERN = /^\s*[-*+]\s+\[([ xX])\]/;

export function getChecklistStats(markdown: string): ChecklistStats | null {
  let done = 0;
  let total = 0;
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = ITEM_PATTERN.exec(line);
    if (!match) continue;
    total += 1;
    if (match[1]?.toLowerCase() === "x") done += 1;
  }
  return total === 0 ? null : { done, total };
}
