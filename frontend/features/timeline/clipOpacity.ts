// frontend/features/timeline/clipOpacity.ts

// "How solid is this overlay at second T?" — the fade envelope.
//
// Pure and React-free, sitting beside activeClips.ts for the same reason:
// `isClipActive` answers WHETHER to draw an overlay, this answers HOW STRONGLY,
// and M8's exporter must be able to ask both questions per frame and get exactly
// the answers the editor showed.

import { isClipActive } from "./activeClips";
import type { OverlayClip } from "./types";

// Linear interpolation, from first principles and nothing more.
//
// A fade is just "how far through the ramp am I, as a fraction". If a 0.5s
// fade-in is 0.2s along, you are 0.2/0.5 = 0.4 of the way through, so you draw
// at 40%. That single division is the entire idea — there is no curve, no easing,
// no state. Given the same clip and the same time it returns the same number
// forever, which is what makes it safe to call 60 times a second in the editor
// and 30 times a second in the exporter.
//
// The result is the clip's BASE opacity multiplied by the envelope, never
// replaced by it. An overlay set to 50% opacity that fades in reaches 50%, not
// 100% — the fade scales what you asked for rather than overriding it.
export function clipOpacityAt(clip: OverlayClip, time: number): number {
  // Outside its own window an overlay is not drawn at all. Asking about opacity
  // there is meaningless, and returning 0 keeps every caller honest without them
  // needing to check twice.
  if (!isClipActive(clip, time)) return 0;

  const elapsed = time - clip.start;
  const remaining = clip.start + clip.duration - time;

  let envelope = 1;

  if (clip.fadeIn > 0 && elapsed < clip.fadeIn) {
    envelope = elapsed / clip.fadeIn;
  }

  if (clip.fadeOut > 0 && remaining < clip.fadeOut) {
    // Math.min, not assignment — and this one line is what makes the awkward
    // case behave itself. Give a 2s clip a 1.5s fade-in AND a 1.5s fade-out and
    // the two ramps overlap in the middle. Taking the SMALLER of the two means
    // whichever ramp is more restrictive at this instant wins, so the overlay
    // simply peaks lower than full instead of producing a value above 1 or
    // flickering between the two. No special case, no clamping, no error to
    // report to the user.
    envelope = Math.min(envelope, remaining / clip.fadeOut);
  }

  return clip.transform.opacity * envelope;
}
