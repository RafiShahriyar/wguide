// frontend/features/timeline/timelineSlice.ts

import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { clamp } from "@/utils/clamp";
import {
  ZOOM_HARD_MAX,
  maxViewportStart,
  minZoomFor,
  type ViewportBounds,
} from "./timelineCoords";
import {
  DEFAULT_TRANSFORM,
  MAX_SCALE,
  MIN_CLIP_DURATION,
  MIN_SCALE,
} from "./newClip";
import { roundPosition } from "./overlayCoords";
import type {
  ClipPatch,
  NewOverlayClip,
  OverlayClip,
  Track,
} from "./types";

// The timeline slice holds TWO kinds of concern:
//   • the VIEWPORT (zoom, pan) — pure UI, never saved
//   • the DATA (tracks → clips) — absolute seconds, saved in M9
// Zoom is "pixels per second". A larger zoom = more zoomed in.
export const DEFAULT_ZOOM = 40;

// Both limits depend on the video's length and the panel's width, which live
// outside this slice — so every viewport action carries a `bounds` payload.
// These two helpers are the only place the limits get applied.
function clampZoom(zoom: number, bounds: ViewportBounds): number {
  const safe = Number.isFinite(zoom) ? zoom : DEFAULT_ZOOM;
  return clamp(safe, minZoomFor(bounds), ZOOM_HARD_MAX);
}

function clampStart(
  start: number,
  zoom: number,
  bounds: ViewportBounds,
): number {
  const safe = Number.isFinite(start) ? start : 0;
  return clamp(safe, 0, maxViewportStart(bounds, zoom));
}

// A NaN reaching geometry is uniquely nasty: it renders as `scale(NaN)`, the
// overlay silently vanishes, and nothing anywhere reports an error. Numbers are
// refused at the door instead. `Infinity` is caught by the same check.
function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

// Fold any angle into a single turn, so 370° and 730° both become 10° and −270°
// becomes 90°. Without this, spinning a slider or loading an odd project file
// could store 3600° — visually identical to 0° but nonsense to read in the
// inspector, and something M8 would have to re-derive.
//
// The `((n % 360) + 360) % 360` dance is the standard fix for JavaScript's `%`,
// which keeps the sign of the left operand: `-90 % 360` is `-90`, not `270`.
function normalizeRotation(degrees: number): number {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

export interface TimelineState {
  // pixels per second — how wide one second of time is drawn
  zoom: number;
  // the second shown at the left edge of the timeline (pan position)
  viewportStart: number;
  // the overlay data: vertical lanes of clips
  tracks: Track[];
  // which clip the Properties panel is editing (null = none)
  // Which clips the Properties panel is editing and a drag would move. An array
  // rather than a single id: everything downstream now has to cope with 0, 1 or N.
  selectedClipIds: string[];
  // The clip a Shift-click measures its range FROM — the last one clicked
  // deliberately. Kept separate from the selection because the selection is a SET
  // with no meaningful order, while "the one you clicked last" is its own fact.
  selectionAnchorId: string | null;
}

function makeDefaultTrack(): Track {
  return { id: "track-overlays", name: "Overlays", clips: [] };
}

const initialState: TimelineState = {
  zoom: DEFAULT_ZOOM,
  viewportStart: 0,
  tracks: [makeDefaultTrack()],
  selectedClipIds: [],
  selectionAnchorId: null,
};

const timelineSlice = createSlice({
  name: "timeline",
  initialState,
  reducers: {
    // Directly set zoom, clamped to what this video/panel allows.
    setZoom(
      state,
      action: PayloadAction<{ zoom: number; bounds: ViewportBounds }>,
    ) {
      const { bounds } = action.payload;
      state.zoom = clampZoom(action.payload.zoom, bounds);
      state.viewportStart = clampStart(state.viewportStart, state.zoom, bounds);
    },
    // Shift the viewport by a number of seconds (pan). Kept inside the video.
    panBy(
      state,
      action: PayloadAction<{ seconds: number; bounds: ViewportBounds }>,
    ) {
      state.viewportStart = clampStart(
        state.viewportStart + action.payload.seconds,
        state.zoom,
        action.payload.bounds,
      );
    },
    // Jump the viewport to an absolute second (e.g. after a scroll).
    setViewportStart(
      state,
      action: PayloadAction<{ start: number; bounds: ViewportBounds }>,
    ) {
      state.viewportStart = clampStart(
        action.payload.start,
        state.zoom,
        action.payload.bounds,
      );
    },
    // Zoom by a factor (1.1 = in, 0.9 = out) anchored at a pixel X. The second
    // currently under `anchorX` stays under it after the zoom.
    zoomAt(
      state,
      action: PayloadAction<{
        factor: number;
        anchorX: number;
        bounds: ViewportBounds;
      }>,
    ) {
      const { anchorX, bounds } = action.payload;
      const factor = Number.isFinite(action.payload.factor)
        ? action.payload.factor
        : 1;
      const anchorTime = state.viewportStart + anchorX / state.zoom;
      const newZoom = clampZoom(state.zoom * factor, bounds);
      state.zoom = newZoom;
      state.viewportStart = clampStart(
        anchorTime - anchorX / newZoom,
        newZoom,
        bounds,
      );
    },
    // Zoom all the way out: the whole video exactly fills the panel.
    fitToWindow(state, action: PayloadAction<{ bounds: ViewportBounds }>) {
      state.zoom = minZoomFor(action.payload.bounds);
      state.viewportStart = 0;
    },
    // Re-apply both limits without otherwise changing the view. Dispatched when
    // the video or the panel width changes, so a viewport that was legal a
    // moment ago (but isn't now) gets pulled quietly back into range.
    clampViewport(state, action: PayloadAction<{ bounds: ViewportBounds }>) {
      const { bounds } = action.payload;
      state.zoom = clampZoom(state.zoom, bounds);
      state.viewportStart = clampStart(state.viewportStart, state.zoom, bounds);
    },

    // --- clip data actions -------------------------------------------------

    // Add a clip to the first track (the "Overlays" lane) and select it.
    // The id is minted here so callers never have to care.
    addClip(state, action: PayloadAction<NewOverlayClip>) {
      const clip: OverlayClip = { id: crypto.randomUUID(), ...action.payload };
      state.tracks[0].clips.push(clip);
      state.selectedClipIds = [clip.id];
      state.selectionAnchorId = clip.id;
    },
    // Plain click: this clip and nothing else. `null` clears the selection.
    selectClip(state, action: PayloadAction<string | null>) {
      state.selectedClipIds = action.payload === null ? [] : [action.payload];
      state.selectionAnchorId = action.payload;
    },
    // Ctrl/Cmd-click: add if absent, remove if present.
    toggleClipSelection(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.selectedClipIds = state.selectedClipIds.includes(id)
        ? state.selectedClipIds.filter((selected) => selected !== id)
        : [...state.selectedClipIds, id];
      state.selectionAnchorId = id;
    },
    // Shift-click: everything between the anchor and this clip, within the track
    // that holds them both. Ordered by START time, not by array order — the clips
    // array is in creation order, and "between" has to mean between in TIME or the
    // selection would look arbitrary.
    selectClipRange(state, action: PayloadAction<string>) {
      const toId = action.payload;
      const anchorId = state.selectionAnchorId;

      const track =
        anchorId === null
          ? undefined
          : state.tracks.find(
              (candidate) =>
                candidate.clips.some((clip) => clip.id === anchorId) &&
                candidate.clips.some((clip) => clip.id === toId),
            );

      // No anchor, or the two clips are in different tracks: fall back to a plain
      // selection rather than guessing at what the user meant.
      if (anchorId === null || anchorId === toId || !track) {
        state.selectedClipIds = [toId];
        state.selectionAnchorId = toId;
        return;
      }

      const anchor = track.clips.find((clip) => clip.id === anchorId)!;
      const target = track.clips.find((clip) => clip.id === toId)!;
      const low = Math.min(anchor.start, target.start);
      const high = Math.max(anchor.start, target.start);

      state.selectedClipIds = track.clips
        .filter((clip) => clip.start >= low && clip.start <= high)
        .map((clip) => clip.id);
      // The anchor deliberately does NOT move: shift-clicking again re-measures
      // from the same place, which is what makes a range adjustable.
    },
    // Move every clip in a group by one shared delta.
    //
    // This is a separate action rather than N `updateClip` dispatches, and the
    // reason is the clamp below. Each caller passes the start to measure FROM: for
    // a drag that is where the clip sat when the gesture began (every dispatch
    // re-renders, so reading the live value mid-drag compounds); for a keyboard
    // nudge it is simply the clip's current start. Hence `fromStart` rather than
    // anything drag-specific — the action serves both callers unchanged.
    moveClips(
      state,
      action: PayloadAction<{
        moves: Array<{ id: string; fromStart: number }>;
        deltaSeconds: number;
        videoDuration?: number;
      }>,
    ) {
      const { moves, deltaSeconds, videoDuration } = action.payload;
      if (moves.length === 0) return;

      const videoEnd =
        videoDuration !== undefined &&
        Number.isFinite(videoDuration) &&
        videoDuration > 0
          ? videoDuration
          : null;
      const latestStart =
        videoEnd === null ? Infinity : Math.max(0, videoEnd - MIN_CLIP_DURATION);

      // Clamp the DELTA once for the whole group — never each clip on its own.
      // Clamping per clip would let the leftmost stop at 0:00 while the others
      // carried on, and the relative spacing between them, the very thing you
      // selected them together to preserve, would be destroyed. Only code that can
      // see every clip at once can enforce that, which is why this action exists.
      let allowed = finiteOr(deltaSeconds, 0);
      for (const move of moves) {
        allowed = clamp(allowed, -move.fromStart, latestStart - move.fromStart);
      }

      for (const move of moves) {
        const clip = findClip(state, move.id);
        if (clip) clip.start = move.fromStart + allowed;
      }
    },
    // Copy every selected clip and drop the copies immediately after the group.
    duplicateClips(
      state,
      action: PayloadAction<{ ids: string[]; videoDuration?: number }>,
    ) {
      const wanted = new Set(action.payload.ids);
      const originals: OverlayClip[] = [];
      for (const track of state.tracks) {
        for (const clip of track.clips) {
          if (wanted.has(clip.id)) originals.push(clip);
        }
      }
      if (originals.length === 0) return;

      // The copies are shifted by the SPAN of the whole selection, so the new group
      // lands just past the old one with its internal spacing intact. Offsetting
      // each clip by its own length instead would scramble a group's rhythm — the
      // same reasoning as the shared delta in moveClips.
      const groupStart = Math.min(...originals.map((clip) => clip.start));
      const groupEnd = Math.max(
        ...originals.map((clip) => clip.start + clip.duration),
      );

      const videoEnd =
        action.payload.videoDuration !== undefined &&
        Number.isFinite(action.payload.videoDuration) &&
        action.payload.videoDuration > 0
          ? action.payload.videoDuration
          : null;
      const latestStart =
        videoEnd === null ? Infinity : Math.max(0, videoEnd - MIN_CLIP_DURATION);

      // One shared offset, narrowed until every copy fits inside the footage. If
      // there is no room at all this collapses to 0 and the copies land on top of
      // the originals — visible and draggable, which beats silently creating clips
      // beyond the end of the video where nothing would ever render them.
      let offset = groupEnd - groupStart;
      for (const clip of originals) {
        offset = Math.min(offset, latestStart - clip.start);
      }
      offset = Math.max(0, offset);

      const copies: string[] = [];
      for (const track of state.tracks) {
        // Collect first, push after: growing `track.clips` while iterating it would
        // walk into the copies and duplicate them again, forever.
        const additions: OverlayClip[] = [];
        for (const clip of track.clips) {
          if (!wanted.has(clip.id)) continue;
          const copy = copyClip(clip, offset);
          additions.push(copy);
          copies.push(copy.id);
        }
        track.clips.push(...additions);
      }

      // Select the copies, not the originals: the thing you almost always want next
      // is to drag what you just made.
      state.selectedClipIds = copies;
      state.selectionAnchorId = copies[copies.length - 1] ?? null;
    },
updateClip(
      state,
      action: PayloadAction<{
        id: string;
        patch: ClipPatch;
        // The video's length, which lives in the PLAYER slice. Callers that touch
        // `start` or `duration` pass it so those can be held inside the footage;
        // transform-only callers (the drag, the geometry sliders) omit it
        // legitimately, because they cannot violate that rule.
        videoDuration?: number;
      }>,
    ) {
      const clip = findClip(state, action.payload.id);
      if (!clip) return;
      const { patch, videoDuration } = action.payload;

      // Only trust a real, positive length. Before metadata loads `duration` is
      // 0, and clamping against 0 would collapse every clip to the very start.
      const videoEnd =
        videoDuration !== undefined &&
        Number.isFinite(videoDuration) &&
        videoDuration > 0
          ? videoDuration
          : null;

      if (patch.name !== undefined) clip.name = patch.name;
      // The invariants ("never before 0:00", "never shorter than we can draw",
      // "never past the end of the footage") live HERE rather than in the
      // properties form. Any future caller — a drag in M7, a pasted project file
      // in M9 — gets them for free, and the form is left to worry only about
      // what the user typed.
      if (patch.start !== undefined) {
        // Leave at least MIN_CLIP_DURATION of video after the start, so a clip
        // can never be parked somewhere it could not possibly be seen.
        const latestStart =
          videoEnd === null ? Infinity : Math.max(0, videoEnd - MIN_CLIP_DURATION);
        clip.start = clamp(finiteOr(patch.start, clip.start), 0, latestStart);
      }
      if (patch.duration !== undefined) {
        const longest =
          videoEnd === null
            ? Infinity
            : Math.max(MIN_CLIP_DURATION, videoEnd - clip.start);
        clip.duration = clamp(
          finiteOr(patch.duration, clip.duration),
          MIN_CLIP_DURATION,
          longest,
        );
        // An invariant that spans two fields: shortening a clip must not leave a
        // fade longer than the clip it belongs to. Doing this here means the
        // Length box cannot produce a nonsensical pair, however it is edited.
        clip.fadeIn = Math.min(clip.fadeIn, clip.duration);
        clip.fadeOut = Math.min(clip.fadeOut, clip.duration);
      }
      if (patch.fadeIn !== undefined) {
        clip.fadeIn = clamp(finiteOr(patch.fadeIn, 0), 0, clip.duration);
      }
      if (patch.fadeOut !== undefined) {
        clip.fadeOut = clamp(finiteOr(patch.fadeOut, 0), 0, clip.duration);
      }
      // `props` can't just be assigned: `clip` is now a union, so TypeScript
      // wants proof that the incoming props match THIS clip's kind. The `in`
      // operator is the check — "does this object have a `keys` field?" — and
      // it narrows both sides at once. A mismatched patch is ignored rather
      // than corrupting the clip.
      if (patch.props !== undefined) {
        if (clip.kind === "keyboard" && "keys" in patch.props) {
          clip.props = patch.props;
        } else if (clip.kind === "text" && "text" in patch.props) {
          clip.props = patch.props;
        }
      }
      // Geometry. Every field is clamped HERE rather than in the drag handler or
      // the sliders, for the same reason `start` and `duration` are: "an overlay
      // never leaves the frame" is a rule about the DATA, so it belongs where the
      // data changes. The drag, the inspector's fields and M9's project loader
      // all get it without asking.
      //
      // Note this builds the object field by field instead of spreading
      // `patch.transform`. That is deliberate: if ClipTransform ever gains a
      // sixth field, this object literal stops compiling until the new field is
      // given a rule here — the compiler enforces that no geometry goes
      // unguarded.
      if (patch.transform !== undefined) {
        const next = patch.transform;
        clip.transform = {
          x: roundPosition(clamp(finiteOr(next.x, DEFAULT_TRANSFORM.x), 0, 1)),
          y: roundPosition(clamp(finiteOr(next.y, DEFAULT_TRANSFORM.y), 0, 1)),
          scale: clamp(
            finiteOr(next.scale, DEFAULT_TRANSFORM.scale),
            MIN_SCALE,
            MAX_SCALE,
          ),
          rotation: normalizeRotation(
            finiteOr(next.rotation, DEFAULT_TRANSFORM.rotation),
          ),
          opacity: clamp(finiteOr(next.opacity, DEFAULT_TRANSFORM.opacity), 0, 1),
        };
      }
    },
    // Delete a whole set at once. A Set for the lookup so deleting 50 clips from
    // 500 stays linear rather than quadratic.
    deleteClips(state, action: PayloadAction<string[]>) {
      const doomed = new Set(action.payload);
      if (doomed.size === 0) return;
      for (const track of state.tracks) {
        track.clips = track.clips.filter((clip) => !doomed.has(clip.id));
      }
      state.selectedClipIds = state.selectedClipIds.filter(
        (id) => !doomed.has(id),
      );
      if (state.selectionAnchorId !== null && doomed.has(state.selectionAnchorId)) {
        state.selectionAnchorId = null;
      }
    },
  },
});

// A copy of a clip with a fresh id, shifted in time.
//
// Every nested value is copied explicitly. `{ ...clip, id: newId }` would hand the
// copy the SAME `transform` object and the same `props.keys` array as the original —
// two clips sharing one piece of mutable state, which is the trap
// `{ ...DEFAULT_TRANSFORM }` avoided in M6. It happens to be harmless today because
// `updateClip` replaces those objects wholesale rather than mutating them, but that
// is a property of code somewhere else that could change at any time.
//
// The fields are also listed one by one rather than spread, so a new field on
// ClipBase stops this compiling until it has been considered here — the same
// compile-time coverage the transform block gets in `updateClip`.
function copyClip(clip: OverlayClip, offsetSeconds: number): OverlayClip {
  const base = {
    id: crypto.randomUUID(),
    name: clip.name,
    start: clip.start + offsetSeconds,
    duration: clip.duration,
    fadeIn: clip.fadeIn,
    fadeOut: clip.fadeOut,
    transform: { ...clip.transform },
  };

  return clip.kind === "keyboard"
    ? { ...base, kind: "keyboard", props: { keys: [...clip.props.keys] } }
    : { ...base, kind: "text", props: { ...clip.props } };
}

// Small pure helper: find a clip by id across all tracks (used by reducers).
function findClip(state: TimelineState, id: string): OverlayClip | undefined {
  for (const track of state.tracks) {
    const found = track.clips.find((c) => c.id === id);
    if (found) return found;
  }
  return undefined;
}

export const {
  setZoom,
  panBy,
  setViewportStart,
  zoomAt,
  fitToWindow,
  clampViewport,
  addClip,
  selectClip,
  toggleClipSelection,
  selectClipRange,
  moveClips,
  duplicateClips,
  updateClip,
  deleteClips,
} = timelineSlice.actions;

export default timelineSlice.reducer;