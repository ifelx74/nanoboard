import { defineConfig, loadEnv } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");

  return {
    plugins: [
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
        // Keep co-located route tests out of the generated route tree.
        routeFileIgnorePattern: "\\.test\\.tsx?$",
      }),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        devOptions: {
          // Enable with `VITE_APP_ENABLE_PWA=true` to test install/offline in dev.
          enabled: env.VITE_APP_ENABLE_PWA === "true",
        },
        includeAssets: ["favicon.svg", "apple-touch-icon.png"],
        workbox: {
          // Precache every built asset, including lazily-loaded feature chunks
          // (whiteboard/Excalidraw adds ~3.5MB). Deliberate: this is an
          // offline-first app and a first-visit-while-offline whiteboard must
          // work. Content hashing keeps the recurring update cost near zero —
          // the big chunks only re-download on dependency bumps. If install
          // size ever matters measurably, switch to excluding feature chunks
          // plus a CacheFirst runtimeCaching rule (offline then only after
          // first online visit).
          globPatterns: ["**/*.{js,css,html,woff,woff2}"],
          cleanupOutdatedCaches: true,
        },
        manifest: {
          name: "Nanoboard",
          short_name: "Nanoboard",
          description:
            "A local-first kanban board for organizing projects, tasks, and resources.",
          id: "/",
          start_url: "/",
          scope: "/",
          display: "standalone",
          theme_color: "#ffffff",
          background_color: "#ffffff",
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "maskable-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "maskable-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };
});
