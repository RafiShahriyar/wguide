// frontend/features/timeline/snapping.ts

// Making clip edges stick to meaningful moments while you drag.
//
// Pure and React-free like the other coordinate helpers. Unlike them it is NOT
// something M8's exporter needs — snapping is an editing affordance, and by the
// time a project is exported every clip is already at an exact second. It lives
// here for the other reason: it is fiddly arithmetic with edge cases, and pure
// functions are the only kind you can check with confidence.

import type { Track } from "./types";

// How close, in PIXELS, an edge must come before it snaps.
//
// Pixels, not seconds — and that choice is the whole design. The caller divides
// this by `zoom` to get a tolerance in seconds, so snapping feels IDENTICAL at
// every zoom level: at 400 px/s it is 0.02s of tolerance, at 10 px/s it is 0.8s.
// Define it in seconds instead and it would be immovably sticky when zoomed out
// and useless when zoomed in.
export const SNAP_PX = 8;

export interface SnapResult {
  // The snapped time, or the original candidate if nothing was close enough.
  time: number;
  // The target we snapped to, for drawing the guide line — null if no snap.
  guide: number | null;
}

// Snap one time to the nearest target within tolerance.
export function snapTime(
  candidate: number,
  targets: number[],
  toleranceSeconds: number,
): SnapResult {
  // tolerance <= 0 is how the caller says "snapping off" (Alt held). Bailing here
  // means the bypass needs no separate branch anywhere else.
  if (toleranceSeconds <= 0) return { time: candidate, guide: null };

  let best: number | null = null;
  let bestDistance = Infinity;

  for (const target of targets) {
    const distance = Math.abs(target - candidate);
    // Strictly less than, so the FIRST of two equidistant targets wins rather
    // than the last. Arbitrary either way, but stable — the same drag always
    // gives the same answer instead of depending on array order changing.
    if (distance <= toleranceSeconds && distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }

  return best === null ? { time: candidate, guide: null } : { time: best, guide: best };
}

// Snap a clip that is being MOVED, considering both of its edges.
//
// A move should snap whichever edge is closest to something — that is what lets
// you butt a clip's end up against another clip's start, not just its beginning.
// When both edges have a candidate, the SMALLER correction wins: the clip jumps as
// little as possible, which is what makes snapping feel like assistance rather
// than like the clip being yanked around.
export function snapMovedClip(
  candidateStart: number,
  duration: number,
  targets: number[],
  toleranceSeconds: number,
): SnapResult {
  const candidateEnd = candidateStart + duration;
  const byStart = snapTime(candidateStart, targets, toleranceSeconds);
  const byEnd = snapTime(candidateEnd, targets, toleranceSeconds);

  // Infinity for "this edge found nothing", so the comparison below needs no
  // special cases for the three possible combinations.
  const startCorrection =
    byStart.guide === null ? Infinity : Math.abs(byStart.time - candidateStart);
  const endCorrection =
    byEnd.guide === null ? Infinity : Math.abs(byEnd.time - candidateEnd);

  if (startCorrection === Infinity && endCorrection === Infinity) {
    return { time: candidateStart, guide: null };
  }

  if (startCorrection <= endCorrection) return byStart;

  // The END snapped, so the start is derived by subtracting the length. The clip
  // keeps its duration exactly — a move never resizes.
  return { time: byEnd.time - duration, guide: byEnd.guide };
}

// Every moment worth sticking to: the playhead, both ends of every OTHER clip,
// the start of the video, and its end.
//
// `excludeClipIds` is every clip that is MOVING — the whole selection, not just
// the one under the cursor. Excluding them is not an optimisation: leave a moving
// clip in and it snaps to where it already is and cannot be dragged at all, and
// leave its fellow travellers in and the group snaps to itself.
//
// Deliberately NOT included: ruler ticks. At low zoom every tick becomes a magnet
// and dragging turns gritty; the ticks are a reading aid, not a grid.
export function collectSnapTargets({
  tracks,
  excludeClipIds,
  playhead,
  videoDuration,
}: {
  tracks: Track[];
  excludeClipIds: Iterable<string>;
  playhead: number;
  videoDuration: number;
}): number[] {
  const excluded = new Set(excludeClipIds);
  const targets: number[] = [0, playhead];
  if (videoDuration > 0) targets.push(videoDuration);

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (excluded.has(clip.id)) continue;
      targets.push(clip.start, clip.start + clip.duration);
    }
  }

  return targets;
}
