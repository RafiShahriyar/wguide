// frontend/features/timeline/newClip.ts

// What a freshly-added overlay looks like. Kept out of the component so the
// "what are sensible defaults?" decision lives in one place — the properties
// editor (Step 5) and any future duplicate/paste action want the same answer.

import type { NewOverlayClip, OverlayKind } from "./types";

// How long a new overlay lasts, in seconds. Long enough to see, short enough
// that a rotation guide isn't one giant block.
export const DEFAULT_CLIP_DURATION = 2;

// Never create something too short to see or click, even at the end of a video.
// Also the floor `updateClip` enforces when the properties form edits duration.
export const MIN_CLIP_DURATION = 0.5;

// Build a clip starting at `start`, trimmed so it doesn't run off the end of a
// video of `videoDuration` seconds. Returns NewOverlayClip (no id) — `addClip`
// mints the id.
export function makeNewClip(
  kind: OverlayKind,
  start: number,
  videoDuration: number,
): NewOverlayClip {
  const remaining = videoDuration - start;
  const duration = Math.max(
    MIN_CLIP_DURATION,
    Math.min(DEFAULT_CLIP_DURATION, remaining),
  );

  // Note how each branch returns kind AND its matching props together. Because
  // NewOverlayClip is a union, TypeScript checks the pairing here — a "text"
  // clip carrying { keys } simply will not compile.
  if (kind === "keyboard") {
    return { kind, name: "Q", start, duration, props: { keys: ["Q"] } };
  }
  return {
    kind,
    name: "New text",
    start,
    duration,
    props: { text: "New text", color: "#ffffff" },
  };
}
