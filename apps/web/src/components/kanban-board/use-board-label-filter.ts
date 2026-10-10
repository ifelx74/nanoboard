import { useEffect, useState } from "react";
import {
  normalizeLabelFilter,
  toggleLabelFilter,
} from "./board-filter-model";

function storageKey(projectId: string): string {
  return `nanoboard:board-filters:${projectId}`;
}

function readStored(projectId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    return normalizeLabelFilter(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/** Labels-only board filter, persisted per project like Kaneo's filter bar. */
export function useBoardLabelFilter(projectId: string) {
  const [project, setProject] = useState(projectId);
  const [selected, setSelected] = useState<string[] | null>(() =>
    readStored(projectId),
  );

  // The board remounts per project today, but the hook must not depend on
  // that: a project switch without remount re-reads instead of leaking the
  // old selection (and persisting it under the new key).
  if (project !== projectId) {
    setProject(projectId);
    setSelected(readStored(projectId));
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey(projectId),
        JSON.stringify({ labels: selected ?? [] }),
      );
    } catch {
      // Storage may be unavailable or full; keep filtering in memory.
    }
  }, [selected, projectId]);

  return {
    selected,
    toggle: (id: string) =>
      setSelected((current) => toggleLabelFilter(current, id)),
    clear: () => setSelected(null),
  };
}
