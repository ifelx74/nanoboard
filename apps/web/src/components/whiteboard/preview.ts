import type { Whiteboard } from "@/lib/db/schema";

/** What a save flush should do with the project's preview row. */
export type PreviewVerdict = "publish" | "remove";

/**
 * The publish-or-remove rule that keeps the gallery honest: a project is
 * listed iff its whiteboard has actual content, so a save flush publishes a
 * preview row only when the built scene payload still holds at least one
 * element, and removes the row when the canvas was emptied. Takes the
 * *built* payload — buildScenePayload already strips deleted elements, so
 * element presence is exactly the "at least one non-deleted element" rule.
 * Pure by construction (no runtime imports): the gallery's definition of
 * "has a whiteboard" is this function and nothing else.
 */
export function decideWhiteboardPreview(
  payload: Pick<Whiteboard, "elements">,
): PreviewVerdict {
  return payload.elements.length > 0 ? "publish" : "remove";
}
