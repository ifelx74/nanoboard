import { useEffect, useMemo, useState } from "react";
import { useWeekStartsOn } from "@/components/calendar/use-week-starts-on";
import {
  countActiveBoardFilters,
  EMPTY_BOARD_FILTERS,
  normalizeBoardFilters,
  toggleBoardFilterValue,
  type BoardFilterContext,
  type BoardFilters,
  type BoardFilterSubject,
} from "./board-filter-model";
import { useBoardSearch } from "./use-board-search";

function storageKey(projectId: string): string {
  return `nanoboard:board-filters:${projectId}`;
}

function readStored(projectId: string): BoardFilters {
  if (typeof window === "undefined") return EMPTY_BOARD_FILTERS;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return EMPTY_BOARD_FILTERS;
    return normalizeBoardFilters(JSON.parse(raw) as unknown);
  } catch {
    return EMPTY_BOARD_FILTERS;
  }
}

function withoutNegation(
  negated: BoardFilterSubject[] | null,
  subject: BoardFilterSubject,
): BoardFilterSubject[] | null {
  const next = (negated ?? []).filter((entry) => entry !== subject);
  return next.length > 0 ? next : null;
}

/**
 * Board search + filter state: search lives in session memory, filters
 * persist per project. Consumed by the toolbar, the chips bar, and the
 * render-only lane intersection.
 */
export function useBoardTaskView(projectId: string) {
  const { search, setSearch } = useBoardSearch(projectId);
  const [weekStartsOn] = useWeekStartsOn();
  const [project, setProject] = useState(projectId);
  const [filters, setFilters] = useState<BoardFilters>(() =>
    readStored(projectId),
  );

  // Same remount-safe pattern as the search state: a project switch without
  // remount loads that project's stored filters instead of leaking.
  if (project !== projectId) {
    setProject(projectId);
    setFilters(readStored(projectId));
  }

  useEffect(() => {
    try {
      const key = storageKey(projectId);
      const raw = window.localStorage.getItem(key);
      if (raw) {
        // Persist only real changes: the stored value already reads back
        // to this state (legacy shapes included), so rewriting it would be
        // a durable migration the spec rules out.
        const stored = normalizeBoardFilters(JSON.parse(raw) as unknown);
        if (JSON.stringify(stored) === JSON.stringify(filters)) return;
      }
      window.localStorage.setItem(key, JSON.stringify(filters));
    } catch {
      // Storage may be unavailable or full; keep filtering in memory.
    }
  }, [filters, projectId]);

  const toggleFilter = (subject: BoardFilterSubject, value: string) =>
    setFilters((prev) => {
      const next = toggleBoardFilterValue(prev[subject], value);
      return {
        ...prev,
        [subject]: next,
        negated: next ? prev.negated : withoutNegation(prev.negated, subject),
      };
    });

  const setNegated = (subject: BoardFilterSubject, negated: boolean) =>
    setFilters((prev) => ({
      ...prev,
      negated: negated
        ? [
            ...(prev.negated ?? []).filter((entry) => entry !== subject),
            subject,
          ]
        : withoutNegation(prev.negated, subject),
    }));

  const clearSubject = (subject: BoardFilterSubject) =>
    setFilters((prev) => ({
      ...prev,
      [subject]: null,
      negated: withoutNegation(prev.negated, subject),
    }));

  const clearFilters = () => {
    // Clearing restores the full board: search narrows too, so it resets
    // alongside the persisted filters.
    setFilters(EMPTY_BOARD_FILTERS);
    setSearch("");
  };

  const activeFilterCount = countActiveBoardFilters(filters);
  // `today` feeds day-granular week math only: the date key keeps this
  // context (and the lane-intersection memo keyed on it) stable across
  // renders, refreshing only when the day, search, or week preference
  // actually changes.
  const todayKey = new Date().toDateString();
  const context: BoardFilterContext = useMemo(
    () => ({
      query: search,
      today: new Date(),
      weekStartsOn,
    }),
    [search, weekStartsOn, todayKey],
  );

  return {
    search,
    setSearch,
    filters,
    toggleFilter,
    setNegated,
    clearSubject,
    clearFilters,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0,
    context,
  };
}

export type BoardTaskView = ReturnType<typeof useBoardTaskView>;
