// frontend/features/timeline/timelineCoords.ts

// Pure time↔pixel math for the timeline. No React here — these are the same
// formulas from docs/Timeline.md, kept as tiny functions so Step 3's ruler
// and playhead share one truth.

import { clamp } from "@/utils/clamp";

// Convert an absolute second into a pixel X relative to the timeline left edge
// (negative when the time is to the left of the visible viewport).
export function timeToX(
  time: number,
  viewportStart: number,
  zoom: number,
): number {
  return (time - viewportStart) * zoom;
}

// Convert a pixel offset back into an absolute second.
export function xToTime(
  x: number,
  viewportStart: number,
  zoom: number,
): number {
  return viewportStart + x / zoom;
}

// The "nice" steps a ruler should be allowed to label with. Chosen so that the
// labels land on round numbers people expect (0.5s, 1s, 2s, 5s, …).
const TICK_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600, 1200];

// Pick the smallest step whose on-screen width is at least minPx, so labels
// never crowd together no matter how far in/out you zoom.
export function tickStep(zoom: number, minPx = 60): number {
  if (!Number.isFinite(zoom) || zoom <= 0) return TICK_STEPS[0];
  for (const step of TICK_STEPS) {
    if (step * zoom >= minPx) return step;
  }
  return TICK_STEPS[TICK_STEPS.length - 1];
}

// List the tick second-values visible across a viewport of `widthPx`.
// Uses an integer loop index so floating-point drift doesn't accumulate.
export function visibleTicks(
  viewportStart: number,
  widthPx: number,
  zoom: number,
): number[] {
  if (widthPx <= 0 || !Number.isFinite(zoom) || zoom <= 0) return [];
  const step = tickStep(zoom);
  const end = viewportStart + widthPx / zoom;
  const firstIndex = Math.ceil(viewportStart / step);
  const lastIndex = Math.floor(end / step);
  const ticks: number[] = [];
  for (let i = firstIndex; i <= lastIndex; i++) {
    ticks.push(r2(i * step));
  }
  return ticks;
}

// Round to 2 decimals (avoids artifacts like 0.30000000000000004).
function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

// --- clip geometry -----------------------------------------------------
//
// A clip is stored as (start, duration) in SECONDS. To draw it we need a
// (x, width) in PIXELS. That is just timeToX for the left edge plus a second
// unit conversion for the length — kept here, pure, because M7's drag/resize
// will need exactly the same numbers.

// A clip shorter than this would be a hairline you could never see or click,
// so we draw it at this width instead. Cosmetic only — the DATA is untouched.
const MIN_CLIP_WIDTH = 4;

export interface ClipRect {
  x: number;
  width: number;
}

export function clipRect(
  start: number,
  duration: number,
  viewportStart: number,
  zoom: number,
): ClipRect {
  return {
    x: timeToX(start, viewportStart, zoom),
    width: Math.max(duration * zoom, MIN_CLIP_WIDTH),
  };
}

// Is any part of this rect inside the panel? Clips that fail this are skipped
// entirely — same culling idea as visibleTicks, so a project with 500 overlays
// still only builds DOM for the handful currently on screen.
export function isRectVisible(rect: ClipRect, panelWidth: number): boolean {
  return rect.x + rect.width >= 0 && rect.x <= panelWidth;
}

// --- viewport limits ---------------------------------------------------
//
// How far you may zoom out, and how far right you may pan, both depend on two
// numbers the timeline slice cannot see by itself:
//   • duration — lives in the PLAYER slice (the <video> reports it)
//   • width    — measured from the DOM inside the Timeline component
// So the component bundles them into `ViewportBounds` and hands them to the
// reducer in the action payload. The reducer stays pure; it just does the math.

export interface ViewportBounds {
  duration: number; // seconds; 0 when no video is open
  width: number; // px the timeline is drawn in; 0 before it is measured
}

// Absolute safety rails, independent of any video.
export const ZOOM_HARD_MAX = 400; // very zoomed in: ~2.5s across a 1000px panel
const ZOOM_HARD_MIN = 0.5; // half a px per second — a 63-min video in 1900px
const ZOOM_FALLBACK_MIN = 4; // used while we don't know the duration yet

// Do we know enough to apply real limits? (No video, or not measured yet.)
export function hasBounds(bounds: ViewportBounds): boolean {
  return bounds.duration > 0 && bounds.width > 0;
}

// The most zoomed-OUT we allow = exactly "the whole video fills the panel".
// Note the pleasing consequence: at this zoom, maxViewportStart() below works
// out to 0, so fully zoomed out always means "pinned at 0:00, all visible".
export function minZoomFor(bounds: ViewportBounds): number {
  if (!hasBounds(bounds)) return ZOOM_FALLBACK_MIN;
  return clamp(bounds.width / bounds.duration, ZOOM_HARD_MIN, ZOOM_HARD_MAX);
}

// The furthest right we allow panning: the last screenful of the video, so the
// end of the video lands on the right edge and never scrolls into empty space.
export function maxViewportStart(
  bounds: ViewportBounds,
  zoom: number,
): number {
  if (!hasBounds(bounds) || zoom <= 0) return 0;
  return Math.max(0, bounds.duration - bounds.width / zoom);
}