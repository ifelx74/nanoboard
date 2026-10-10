import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import { db } from "@/lib/db/db";
import { resetToSeed } from "@/lib/db/seed";
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

// Dev-only escape hatch: reseed demo content from the console with
// `await resetNanoboardToSeed()`. Never present in production builds.
if (import.meta.env.DEV) {
  const devWindow = window as unknown as Record<string, unknown>;
  devWindow.resetNanoboardToSeed = () => resetToSeed(db);
}

function App() {
  return <RouterProvider router={router} />;
}

const rootElement = document.getElementById("app") as HTMLElement;
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
