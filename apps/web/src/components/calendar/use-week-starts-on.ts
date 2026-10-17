import { useSyncExternalStore } from "react";

export type WeekStartsOnPreference = 0 | 1 | 6;

const STORAGE_KEY = "nanoboard:week-starts-on";

/**
 * Kaneo keeps weekStartsOn in a persisted user-preferences store (default
 * Sunday, set from the account preferences page we don't clone). Here it is
 * a localStorage-backed global preference with the same three options and
 * default; the settings preferences own the toggle UI.
 *
 * The value is shared through a module-level store rather than per-component
 * state: the toggle (settings dialog) and the consumers (calendar grid, board
 * due-date filters) live in different trees, so a local `useState` would leave
 * an open view stale until it remounted.
 */
const listeners = new Set<() => void>();
let current: WeekStartsOnPreference | undefined;

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

function getSnapshot(): WeekStartsOnPreference {
  if (current === undefined) {
    current = typeof window === "undefined" ? 0 : readPreference();
  }
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setPreference(next: WeekStartsOnPreference): void {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Non-persistent session: the in-memory value still applies.
  }
  for (const listener of listeners) listener();
}

export function useWeekStartsOn(): [
  WeekStartsOnPreference,
  (next: WeekStartsOnPreference) => void,
] {
  const value = useSyncExternalStore(subscribe, getSnapshot);
  return [value, setPreference];
}
