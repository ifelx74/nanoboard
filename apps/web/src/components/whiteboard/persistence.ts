import { getNonDeletedElements } from "@excalidraw/excalidraw";
import type { AppState } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { Whiteboard } from "@/lib/db/schema";

/**
 * Replicates the reference app's `clearAppStateForLocalStorage`, which the npm
 * package does not re-export at runtime: it keeps only the appState keys the
 * upstream storage config marks `browser: true` — durable settings (theme,
 * scroll/zoom, grid, tool defaults) — and drops transient state (selection,
 * open dialogs, cursors, in-progress elements). Key set = that upstream config
 * intersected with the installed package's `AppState`; the `satisfies` clause
 * makes renamed or removed keys a build error when bumping the package.
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
  "cursorButton",
  "defaultSidebarDockedPreference",
  "editingGroupId",
  "exportBackground",
  "exportEmbedScene",
  "exportScale",
  "exportWithDarkMode",
  "gridModeEnabled",
  "gridSize",
  "gridStep",
  "isBindingEnabled",
  "lastPointerDownWith",
  "name",
  "objectsSnapModeEnabled",
  "openMenu",
  "openSidebar",
  "penDetected",
  "penMode",
  "previousSelectedElementIds",
  "scrollX",
  "scrollY",
  "scrolledOutside",
  "selectedElementIds",
  "selectedGroupIds",
  "selectedLinearElement",
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
 * appState, and the files map passed through as-is.
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
  return {
    elements: getNonDeletedElements(elements),
    appState: sanitizeAppStateForStorage(appState),
    files,
  };
}
