import { getNonDeletedElements } from "@excalidraw/excalidraw";
import type { AppState } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FileId,
} from "@excalidraw/excalidraw/element/types";
import type { Whiteboard } from "@/lib/db/schema";

/**
 * Replicates the reference app's `clearAppStateForLocalStorage`, which the npm
 * package does not re-export at runtime: it keeps only durable settings
 * (theme, scroll/zoom, grid, tool defaults, export prefs, board name) and
 * drops transient state — selection/group-editing/cursor state is excluded
 * even where upstream persists it, per the spec, and restore() simply falls
 * back to defaults without it. Hand-maintained: re-verify against upstream
 * `APP_STATE_STORAGE_CONF` when bumping the package; the `satisfies` clause
 * makes renamed or removed keys a build error (new keys added upstream are
 * silently absent until reviewed — check the diff on upgrades).
 */
const PERSISTED_APP_STATE_KEYS = [
  "activeTool",
  "currentItemArrowType",
  "currentItemBackgroundColor",
  "currentItemEndArrowhead",
  "currentItemFillStyle",
  "currentItemFontFamily",
  "currentItemFontSize",
  "currentItemOpacity",
  "currentItemRoughness",
  "currentItemRoundness",
  "currentItemStartArrowhead",
  "currentItemStrokeColor",
  "currentItemStrokeStyle",
  "currentItemStrokeWidth",
  "currentItemTextAlign",
  "defaultSidebarDockedPreference",
  "exportBackground",
  "exportEmbedScene",
  "exportScale",
  "exportWithDarkMode",
  "gridModeEnabled",
  "gridSize",
  "gridStep",
  "name",
  "objectsSnapModeEnabled",
  "openMenu",
  "openSidebar",
  "penDetected",
  "penMode",
  "scrollX",
  "scrollY",
  "scrolledOutside",
  "showWelcomeScreen",
  "shouldCacheIgnoreZoom",
  "stats",
  "theme",
  "viewBackgroundColor",
  "zenModeEnabled",
  "zoom",
] as const satisfies readonly (keyof AppState)[];

export function sanitizeAppStateForStorage(
  appState: Partial<AppState>,
): Partial<AppState> {
  const persisted: Partial<AppState> = {};
  for (const key of PERSISTED_APP_STATE_KEYS) {
    if (key in appState) {
      (persisted as Record<string, unknown>)[key] = appState[key];
    }
  }
  return persisted;
}

/**
 * Builds the persisted scene payload: non-deleted elements only (cross-session
 * undo does not exist, so deleted elements are pure dead weight), sanitized
 * appState, and files pruned to the fileIds still referenced by live image
 * elements — deleting an image from the canvas reclaims its bytes on the next
 * save. Undoing a deletion still works in-session because Excalidraw keeps the
 * file in memory; only the persisted payload is pruned.
 */
export function buildScenePayload({
  elements,
  appState,
  files,
}: {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: Whiteboard["files"];
}): Pick<Whiteboard, "elements" | "appState" | "files"> {
  const liveElements = getNonDeletedElements(elements);
  const usedFileIds = new Set<FileId>(
    liveElements
      .filter(
        (element): element is ExcalidrawImageElement =>
          element.type === "image",
      )
      .flatMap((element) => (element.fileId ? [element.fileId] : [])),
  );
  return {
    elements: liveElements,
    appState: sanitizeAppStateForStorage(appState),
    files: Object.fromEntries(
      Object.entries(files).filter(([id]) => usedFileIds.has(id as FileId)),
    ),
  };
}
