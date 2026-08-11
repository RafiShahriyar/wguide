// frontend/features/timeline/activeClips.ts

// "Which overlays should be on screen at second T?" — the whole preview
// depends on this one question. Pure functions, no React, so the M8 renderer
// can ask the exact same thing for every exported frame and get the same
// answer the editor showed.

import type { OverlayClip, Track } from "./types";

// A clip is live over the HALF-OPEN interval [start, start + duration).
//
// Half-open is deliberate. Put one clip at 0–2s and the next at 2–4s: at
// exactly 2.000s a closed interval (<=) would call BOTH of them live, and you
// would get a one-frame flash of two overlays stacked. With `<`, second 2.000
// belongs to exactly one clip. Same reasoning as a ruler's tick belonging to
// one side of a boundary.
export function isClipActive(clip: OverlayClip, time: number): boolean {
  return time >= clip.start && time < clip.start + clip.duration;
}

// Every clip live at `time`, in DRAW order: earlier tracks first, so the
// bottom track paints first and later tracks stack on top. That is the same
// z-order the export pipeline will use in M8.
export function activeClipsAt(tracks: Track[], time: number): OverlayClip[] {
  const active: OverlayClip[] = [];
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (isClipActive(clip, time)) active.push(clip);
    }
  }
  return active;
}
