export interface PageDisplayPrefs {
  isFullWidth: boolean;
  isStickyToolbarEnabled: boolean;
}

export interface PagePrefsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PAGE_DISPLAY_PREF_KEYS = {
  fullWidth: "nanoboard:pages:fullWidth",
  stickyToolbar: "nanoboard:pages:stickyToolbar",
} as const;

export const DEFAULT_PAGE_DISPLAY_PREFS: PageDisplayPrefs = {
  isFullWidth: false,
  isStickyToolbarEnabled: true,
};

function getDefaultStorage(): PagePrefsStorage | null {
  try {
    return typeof globalThis !== "undefined" && "localStorage" in globalThis
      ? globalThis.localStorage
      : null;
  } catch {
    return null;
  }
}

function parseBooleanPref(raw: string | null, fallback: boolean): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

export function readPageDisplayPrefs(
  storage: PagePrefsStorage | null = getDefaultStorage(),
): PageDisplayPrefs {
  if (!storage) return { ...DEFAULT_PAGE_DISPLAY_PREFS };
  try {
    return {
      isFullWidth: parseBooleanPref(
        storage.getItem(PAGE_DISPLAY_PREF_KEYS.fullWidth),
        DEFAULT_PAGE_DISPLAY_PREFS.isFullWidth,
      ),
      isStickyToolbarEnabled: parseBooleanPref(
        storage.getItem(PAGE_DISPLAY_PREF_KEYS.stickyToolbar),
        DEFAULT_PAGE_DISPLAY_PREFS.isStickyToolbarEnabled,
      ),
    };
  } catch {
    return { ...DEFAULT_PAGE_DISPLAY_PREFS };
  }
}

export function writePageDisplayPrefs(
  patch: Partial<PageDisplayPrefs>,
  storage: PagePrefsStorage | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    if (patch.isFullWidth !== undefined) {
      storage.setItem(
        PAGE_DISPLAY_PREF_KEYS.fullWidth,
        String(patch.isFullWidth),
      );
    }
    if (patch.isStickyToolbarEnabled !== undefined) {
      storage.setItem(
        PAGE_DISPLAY_PREF_KEYS.stickyToolbar,
        String(patch.isStickyToolbarEnabled),
      );
    }
  } catch {
    // Ignore storage access / quota errors in restricted browsing contexts.
  }
}
