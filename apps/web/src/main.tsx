import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "@/index.css";
import { db } from "@/lib/db/db";
import { resetToSeed } from "@/lib/db/seed";
import { applyThemeClass, useThemeStore } from "@/store/theme";
import { applyLocale, getResolvedLocale, useLocaleStore } from "@/store/locale";
import { initI18n } from "@/lib/i18n/index";
import { I18nProvider } from "@/lib/i18n/provider";
import { Toaster } from "@/components/ui/toast";
import { routeTree } from "./routeTree.gen";

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

registerSW({ immediate: true });

// The inline pre-paint script in index.html applies the persisted theme before
// first paint; keep the root class in sync for hydration and runtime flips.
useThemeStore.subscribe((state) => applyThemeClass(state.theme));

// Same for the locale: keep the resolved language and document.lang in sync
// with the persisted preference for the app's whole lifetime.
useLocaleStore.subscribe((state) => applyLocale(state.locale));

// Dev-only escape hatch: wipe and reseed the demo content from the console
// with `await resetNanoboardToSeed()`. The populate seeding fires only on
// database creation, so this is how an existing dev database gets the demo
// content back. Never present in production builds.
if (import.meta.env.DEV) {
  const devWindow = window as unknown as Record<string, unknown>;
  devWindow.resetNanoboardToSeed = () => resetToSeed(db);
}

function App() {
  return (
    <Toaster>
      <RouterProvider router={router} />
    </Toaster>
  );
}

function renderApp() {
  const rootElement = document.getElementById("app") as HTMLElement;
  if (!rootElement.innerHTML) {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <I18nProvider>
          <App />
        </I18nProvider>
      </StrictMode>,
    );
  }
}

// Await initial translation resources before first render so there is no
// raw-key flash and no wrong-language UI; if loading fails the app renders
// anyway with i18next fallback behavior.
initI18n(getResolvedLocale(useLocaleStore.getState().locale))
  .catch(() => undefined)
  .finally(renderApp);
