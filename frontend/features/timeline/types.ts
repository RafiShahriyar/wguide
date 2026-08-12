// frontend/features/timeline/types.ts

// The overlay data model — the shape the real project files (M9) will
// serialize. Everything is measured in ABSOLUTE seconds, never pixels.

// What kinds of overlay a clip can be. New kinds (mouse, arrow, image) extend
// this union later.
export type OverlayKind = "keyboard" | "text";

// "Keyboard" overlays draw a set of keycaps; "text" draws a label.
export interface KeyboardProps {
  keys: string[];
}

export interface TextProps {
  text: string;
  color: string;
}

export type OverlayClipProps = KeyboardProps | TextProps;

// Where an overlay sits on the video frame, how big it is, and how solidly it
// is drawn.
//
// THE UNITS DECIDE EVERYTHING ELSE, so they are worth stating plainly:
//
//   x, y      FRACTIONS of the frame, 0–1 — not pixels. x: 0.5 means "halfway
//             across", y: 0.85 means "85% of the way down". The preview is
//             maybe 800px wide while M8 exports at 1920px; a fraction means
//             the same thing in both, a pixel does not.
//   scale     multiplier on the overlay's natural size; 1 = the default size.
//             Measured against the frame's HEIGHT, never its width, so
//             ultrawide footage doesn't shrink every overlay to nothing.
//   rotation  degrees, clockwise.
//   opacity   0 = invisible, 1 = solid.
//
// The anchor is the overlay's CENTRE throughout: (x, y) locates the centre, and
// rotation spins about that same point. Anchoring at the top-left instead would
// swing a rotated overlay away from the cursor as you dragged it.
export interface ClipTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

// Fields every clip has, whatever its kind. Not exported — it only exists to
// avoid repeating these seven lines in each variant below.
interface ClipBase {
  id: string;
  name: string;
  start: number; // seconds (absolute)
  duration: number; // seconds
  // How long the overlay takes to ramp up at its start and down at its end, in
  // SECONDS, measured inwards from each end. 0 = appear/vanish instantly.
  //
  // These live here beside start/duration, NOT inside `transform`, because they
  // are timing rather than geometry: they describe how the overlay behaves over
  // its lifetime, and `transform` describes where it sits.
  fadeIn: number;
  fadeOut: number;
  // Geometry belongs on the BASE, not inside `props`. Every kind of overlay has
  // a position and a size; `props` is only for what makes each kind different
  // (keycaps have `keys`, text has `text`). Putting it here means the mouse,
  // arrow and image kinds get geometry for free when they arrive.
  transform: ClipTransform;
}

export interface KeyboardClip extends ClipBase {
  kind: "keyboard";
  props: KeyboardProps;
}

export interface TextClip extends ClipBase {
  kind: "text";
  props: TextProps;
}

// A clip is a DISCRIMINATED UNION, and the union has to live here at the top
// level — one type that is "either a KeyboardClip or a TextClip". Only then
// does `if (clip.kind === "text")` teach TypeScript that `clip.props` is
// TextProps. (Step 1 had a single interface with `kind` and `props` as
// unrelated fields; that pairs them by convention only, and narrowing on
// `kind` told the compiler nothing about `props`.)
export type OverlayClip = KeyboardClip | TextClip;

// A clip before it has an id — `addClip` mints that. Written as a union of the
// two variants so the kind↔props pairing stays enforced.
export type NewOverlayClip = Omit<KeyboardClip, "id"> | Omit<TextClip, "id">;

// A track owns a vertical lane of clips. Track order is the z-order (bottom
// track renders first).
export interface Track {
  id: string;
  name: string;
  clips: OverlayClip[];
}

// Patch shape for updateClip — every field optional, only what you pass changes.
export interface ClipPatch {
  name?: string;
  start?: number;
  duration?: number;
  fadeIn?: number;
  fadeOut?: number;
  props?: OverlayClipProps;
  // A WHOLE transform, deliberately matching how `props` already works: the
  // caller spreads what it wants to keep, as in `{ ...clip.transform, x: 0.3 }`.
  // `Partial<ClipTransform>` would also work and would let a drag send just
  // x and y — but then two different patch conventions would live side by side
  // in one type. One rule is easier to hold in your head than two.
  transform?: ClipTransform;
}
