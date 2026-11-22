import { useCallback, useEffect, useState } from "react";
import {
  PAGE_DISPLAY_PREF_KEYS,
  readPageDisplayPrefs,
  writePageDisplayPrefs,
  type PageDisplayPrefs,
} from "@/lib/pages/display-prefs";

type Listener = (prefs: PageDisplayPrefs) => void;
const listeners = new Set<Listener>();

function emitPrefsChange(next: PageDisplayPrefs): void {
  for (const listener of listeners) {
    listener(next);
  }
}

/**
 * `localStorage`-persisted display preferences for the Page detail workspace
 * (`Full width` and `Sticky toolbar`), synchronized across components and tabs.
 */
export function usePageDisplayPrefs(): PageDisplayPrefs & {
  setIsFullWidth: (value: boolean) => void;
  setIsStickyToolbarEnabled: (value: boolean) => void;
} {
  const [prefs, setPrefs] = useState<PageDisplayPrefs>(() =>
    readPageDisplayPrefs(),
  );

  useEffect(() => {
    listeners.add(setPrefs);

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === PAGE_DISPLAY_PREF_KEYS.fullWidth ||
        event.key === PAGE_DISPLAY_PREF_KEYS.stickyToolbar
      ) {
        setPrefs(readPageDisplayPrefs());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      listeners.delete(setPrefs);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setIsFullWidth = useCallback((value: boolean) => {
    writePageDisplayPrefs({ isFullWidth: value });
    const next = readPageDisplayPrefs();
    emitPrefsChange(next);
  }, []);

  const setIsStickyToolbarEnabled = useCallback((value: boolean) => {
    writePageDisplayPrefs({ isStickyToolbarEnabled: value });
    const next = readPageDisplayPrefs();
    emitPrefsChange(next);
  }, []);

  return {
    ...prefs,
    setIsFullWidth,
    setIsStickyToolbarEnabled,
  };
}
