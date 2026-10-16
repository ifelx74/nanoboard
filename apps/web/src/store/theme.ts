import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  THEME_STORAGE_KEY,
  parseTheme,
  toggleTheme,
  type Theme,
} from "@/lib/theme-preference";

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

/**
 * Reflect the theme on the document root, which the Tailwind dark variant
 * keys off (`.dark` class). Idempotent: safe to call on every change and
 * after rehydration.
 */
export function applyThemeClass(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/**
 * Binary light/dark preference, persisted across reloads via the same
 * zustand-persist envelope mechanism as the reference design. Fresh users
 * default to light (an explicit departure from the reference default-dark).
 * The pre-paint script in `index.html` applies the stored value before first
 * paint; this store owns runtime reads and flips (switch UI arrives in
 * ticket 02).
 */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "light",
      setTheme: (theme) => {
        const next = parseTheme(theme);
        set({ theme: next });
        applyThemeClass(next);
      },
      toggleTheme: () => {
        const next = toggleTheme(get().theme);
        set({ theme: next });
        applyThemeClass(next);
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        applyThemeClass(parseTheme(state?.theme));
      },
    },
  ),
);
