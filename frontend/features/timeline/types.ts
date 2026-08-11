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

// Fields every clip has, whatever its kind. Not exported — it only exists to
// avoid repeating these four lines in each variant below.
interface ClipBase {
  id: string;
  name: string;
  start: number; // seconds (absolute)
  duration: number; // seconds
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
  props?: OverlayClipProps;
}
