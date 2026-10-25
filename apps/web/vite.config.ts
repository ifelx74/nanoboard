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
          globPatterns: ["**/*.{js,css,html,woff,woff2}"],
          // // Heavy lazily-loaded chunks (the whiteboard/Excalidraw subtree:
          // // 435kB–1.8MB per chunk, ~4MB total) are excluded from the
          // // install-time precache by size — every app-shell chunk is under
          // // 330kB, so a 400kB threshold cleanly separates the two without
          // // naming fragile hashed filenames. Users who never open a
          // // whiteboard never download them; the CacheFirst rule below caches
          // // them on first whiteboard visit, after which offline works. The
          // // one trade: a whiteboard opened offline *before* its first online
          // // visit can't load. Revisit the threshold if a future app-shell
          // // chunk grows past it (the build warning will show what got cut).
          // maximumFileSizeToCacheInBytes: 400 * 1024,
          // runtimeCaching: [
          //   {
          //     // Precached URLs are served by the precache route first; this
          //     // only catches the size-excluded lazy chunks on first fetch.
          //     urlPattern: /\/assets\/.+\.(js|css|woff2?)$/,
          //     handler: "CacheFirst",
          //     options: {
          //       cacheName: "lazy-chunks",
          //     },
          //   },
          // ],
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
