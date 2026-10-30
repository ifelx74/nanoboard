import {
  Excalidraw,
  restoreAppState,
  restoreElements,
  WelcomeScreen,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "./theme.css";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getWhiteboard, saveWhiteboardScene } from "@/lib/db/whiteboards";
import { db } from "@/lib/db/db";
import {
  deleteWhiteboardPreview,
  saveWhiteboardPreview,
} from "@/lib/db/whiteboard-previews";
import type { Whiteboard } from "@/lib/db/schema";
import { useThemeStore } from "@/store/theme";
import { buildScenePayload } from "./persistence";
import { decideWhiteboardPreview } from "./preview";
import { WhiteboardSkeleton } from "./skeleton";

const SAVE_DEBOUNCE_MS = 500;

type ExcalidrawProps = ComponentProps<typeof Excalidraw>;
type InitialData = Exclude<
  ExcalidrawProps["initialData"],
  Promise<unknown> | null | undefined
>;

type PendingScene = Pick<Whiteboard, "elements" | "appState" | "files">;

/**
 * The per-project Excalidraw canvas. This component is the lazy whiteboard
 * chunk: every runtime import of the editor lives here (the db layer only
 * touches Excalidraw types, which are erased at build time). The scene is
 * hydrated once on mount and saved with a ~500ms debounce, flushed on unmount
 * so navigating away never drops the last strokes. Each flush also syncs the
 * project's preview row — published when the payload has content, removed
 * when the canvas was emptied — so the gallery's "has content" index tracks
 * the board without ever reading scene rows. The route remounts this
 * component per project (key={projectId}), so refs never outlive their scene.
 */
export default function WhiteboardCanvas({ projectId }: { projectId: string }) {
  const theme = useThemeStore((state) => state.theme);
  const [initialData, setInitialData] = useState<InitialData | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSceneRef = useRef<PendingScene | null>(null);

  const saveScene = useCallback(
    async (scene: PendingScene) => {
      const payload = buildScenePayload(scene);
      try {
        await saveWhiteboardScene(db, projectId, payload);
      } catch (error) {
        console.error("Failed to save whiteboard:", error);
        return;
      }
      // The preview row rides the successful flush, but the scene save stays
      // authoritative: a preview failure is logged and dropped — it never
      // blocks, rolls back, or corrupts the scene save, and the next flush
      // retries the sync. In this slice the published thumbnail is empty;
      // rendered thumbnails arrive with the gallery slice.
      try {
        if (decideWhiteboardPreview(payload) === "publish") {
          await saveWhiteboardPreview(db, projectId, "");
        } else {
          await deleteWhiteboardPreview(db, projectId);
        }
      } catch (error) {
        console.error("Failed to sync whiteboard preview:", error);
      }
    },
    [projectId],
  );

  const takePendingScene = useCallback(() => {
    const pending = pendingSceneRef.current;
    pendingSceneRef.current = null;
    return pending;
  }, []);

  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const pending = takePendingScene();
    if (pending) void saveScene(pending);
  }, [saveScene, takePendingScene]);

  const handleChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      pendingSceneRef.current = { elements, appState, files };
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveTimeoutRef.current = null;
        const pending = takePendingScene();
        if (pending) void saveScene(pending);
      }, SAVE_DEBOUNCE_MS);
    },
    [saveScene, takePendingScene],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const whiteboard = await getWhiteboard(db, projectId);
        if (cancelled) return;
        setInitialData({
          elements: restoreElements(whiteboard?.elements ?? null, null),
          appState: whiteboard?.appState
            ? restoreAppState(whiteboard.appState, null)
            : null,
          files: whiteboard?.files,
        });
      } catch (error) {
        console.error("Failed to load whiteboard:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => flushSave, [flushSave]);

  // The unmount flush is fire-and-forget; a tab hidden or closed before it
  // lands loses the strokes. Flushing on the earliest hide signals gives the
  // IndexedDB write its best chance to commit. Idempotent — no-op when
  // nothing is pending.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) flushSave();
    };
    window.addEventListener("pagehide", flushSave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushSave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [flushSave]);

  // The app's class-flip treats only "dark" as dark ("system" renders light),
  // so the canvas mirrors that exact resolution.
  const appTheme = theme === "dark" ? "dark" : "light";

  if (!initialData) {
    return <WhiteboardSkeleton />;
  }

  return (
    <div className="h-full w-full whiteboard">
      <Excalidraw
        theme={appTheme}
        initialData={initialData}
        onChange={handleChange}
      >
        <WelcomeScreen>
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Heading>
              Welcome to the Whiteboard
            </WelcomeScreen.Center.Heading>
            <WelcomeScreen.Center.Menu>
              <WelcomeScreen.Center.MenuItemLoadScene />
              <WelcomeScreen.Center.MenuItemHelp />
            </WelcomeScreen.Center.Menu>
          </WelcomeScreen.Center>

          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Hints.MenuHint />
          <WelcomeScreen.Hints.HelpHint />
        </WelcomeScreen>
      </Excalidraw>
    </div>
  );
}
