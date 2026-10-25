import { Excalidraw, restoreAppState, restoreElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getWhiteboard, saveWhiteboardScene } from "@/lib/db/whiteboards";
import { useThemeStore } from "@/store/theme";
import { buildScenePayload } from "./persistence";

const SAVE_DEBOUNCE_MS = 500;

type ExcalidrawProps = ComponentProps<typeof Excalidraw>;
type InitialData = Exclude<
  ExcalidrawProps["initialData"],
  Promise<unknown> | null | undefined
>;

type PendingScene = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
};

/**
 * The per-project Excalidraw canvas. This component is the lazy whiteboard
 * chunk: every runtime import of the editor lives here (the db layer only
 * touches Excalidraw types, which are erased at build time). The scene is
 * hydrated once on mount and saved with a ~500ms debounce, flushed on unmount
 * so navigating away never drops the last strokes.
 */
export default function WhiteboardCanvas({ projectId }: { projectId: string }) {
  const theme = useThemeStore((state) => state.theme);
  const [initialData, setInitialData] = useState<InitialData | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSceneRef = useRef<PendingScene | null>(null);

  const saveScene = useCallback(
    async (scene: PendingScene) => {
      try {
        await saveWhiteboardScene(projectId, buildScenePayload(scene));
      } catch (error) {
        console.error("Failed to save whiteboard:", error);
      }
    },
    [projectId],
  );

  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const pending = pendingSceneRef.current;
    pendingSceneRef.current = null;
    if (pending) void saveScene(pending);
  }, [saveScene]);

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      pendingSceneRef.current = { elements, appState, files };
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        const pending = pendingSceneRef.current;
        pendingSceneRef.current = null;
        if (pending) void saveScene(pending);
      }, SAVE_DEBOUNCE_MS);
    },
    [saveScene],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const whiteboard = await getWhiteboard(projectId);
      if (cancelled) return;
      setInitialData({
        elements: restoreElements(whiteboard?.elements ?? null, null),
        appState: whiteboard?.appState
          ? restoreAppState(whiteboard.appState, null)
          : null,
        files: whiteboard?.files,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => flushSave, [flushSave]);

  // The app's class-flip treats only "dark" as dark ("system" renders light),
  // so the canvas mirrors that exact resolution.
  const appTheme = theme === "dark" ? "dark" : "light";

  if (!initialData) return null;

  return (
    <div className="h-full w-full">
      <Excalidraw
        theme={appTheme}
        initialData={initialData}
        onChange={handleChange}
      />
    </div>
  );
}
