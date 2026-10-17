/**
 * Pure circular-reveal helpers for the sidebar theme switch, kept DOM-free so
 * the plain Node harness covers them directly. DOM queries (`document`,
 * `matchMedia`, click coordinates, viewport size) live in the switch
 * component; the pre-paint script and persisted store own initial paint.
 */

/**
 * Reveal only when the browser can run a view transition and the user has
 * not asked for reduced motion. Every other combination is an instant swap.
 */
export function shouldUseRevealTransition(
  supportsViewTransition: boolean,
  prefersReducedMotion: boolean,
): boolean {
  return supportsViewTransition && !prefersReducedMotion;
}

/**
 * End radius for a circle starting at (x, y) that covers a width x height
 * viewport: distance to the farthest corner.
 */
export function revealEndRadius(
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}
