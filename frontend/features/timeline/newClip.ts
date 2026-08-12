// frontend/features/timeline/newClip.ts

// What a freshly-added overlay looks like. Kept out of the component so the
// "what are sensible defaults?" decision lives in one place — the properties
// editor (Step 5) and any future duplicate/paste action want the same answer.

import type { ClipTransform, NewOverlayClip, OverlayKind } from "./types";

// How long a new overlay lasts, in seconds. Long enough to see, short enough
// that a rotation guide isn't one giant block.
export const DEFAULT_CLIP_DURATION = 2;

// Never create something too short to see or click, even at the end of a video.
// Also the floor `updateClip` enforces when the properties form edits duration.
export const MIN_CLIP_DURATION = 0.5;

// Where a new overlay lands: centred across the frame, 85% of the way down.
//
// These numbers are chosen to match where M5 already stacked everything —
// bottom-centre — so when Step 2 starts honouring the transform, existing
// overlays stay roughly where you last saw them. The change is in HOW they are
// positioned, not in where they appear.
export const DEFAULT_TRANSFORM: ClipTransform = {
  x: 0.5,
  y: 0.85,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

// Hard limits on scale, enforced by the reducer.
//
// Deliberately WIDER than the 0.2–4 the Step 4 slider offers. The slider is a
// comfortable range to drag through; these are the values the DATA will accept.
// Keeping them apart means a deliberately typed 6× or a project file from a
// future version is not rejected for no reason, while nothing can be scaled into
// invisibility or blown up until it swallows the frame.
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 20;

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
  // `{ ...DEFAULT_TRANSFORM }` is a COPY, deliberately. Handing the constant
  // itself to every clip would give them all one shared object, so nudging one
  // overlay could move every other one — and Redux Toolkit freezes whatever
  // ends up in the store, which would quietly freeze the exported constant for
  // the rest of the app. A five-field copy costs nothing; the bug it prevents
  // would be a nightmare to find.
  if (kind === "keyboard") {
    return {
      kind,
      name: "Q",
      start,
      duration,
      props: { keys: ["Q"] },
      // No fade by default: a new overlay appears and vanishes instantly, which
      // is exactly how M5 behaved. Fades are opt-in, set in the inspector.
      fadeIn: 0,
      fadeOut: 0,
      transform: { ...DEFAULT_TRANSFORM },
    };
  }
  return {
    kind,
    name: "New text",
    start,
    duration,
    props: { text: "New text", color: "#ffffff" },
    fadeIn: 0,
    fadeOut: 0,
    transform: { ...DEFAULT_TRANSFORM },
  };
}
