import { useState } from "react";

export type WeekStartsOnPreference = 0 | 1 | 6;

const STORAGE_KEY = "nanoboard:week-starts-on";

function readPreference(): WeekStartsOnPreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "1") return 1;
    if (raw === "6") return 6;
  } catch {
    // Private mode or blocked storage: fall through to the default.
  }
  return 0;
}

/**
 * Kaneo keeps weekStartsOn in a persisted user-preferences store (default
 * Sunday, set from the account preferences page we don't clone). Here it is
 * a localStorage-backed global preference with the same three options and
 * default; the calendar toolbar owns the toggle UI.
 */
export function useWeekStartsOn(): [
  WeekStartsOnPreference,
  (next: WeekStartsOnPreference) => void,
] {
  const [value, setValue] = useState<WeekStartsOnPreference>(() =>
    typeof window === "undefined" ? 0 : readPreference(),
  );

  function set(next: WeekStartsOnPreference): void {
    setValue(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Non-persistent session: the in-memory value still applies.
    }
  }

  return [value, set];
}
