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
import { MIN_CLIP_DURATION } from "./newClip";
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

export interface TimelineState {
  // pixels per second — how wide one second of time is drawn
  zoom: number;
  // the second shown at the left edge of the timeline (pan position)
  viewportStart: number;
  // the overlay data: vertical lanes of clips
  tracks: Track[];
  // which clip the Properties panel is editing (null = none)
  selectedClipId: string | null;
}

function makeDefaultTrack(): Track {
  return { id: "track-overlays", name: "Overlays", clips: [] };
}

const initialState: TimelineState = {
  zoom: DEFAULT_ZOOM,
  viewportStart: 0,
  tracks: [makeDefaultTrack()],
  selectedClipId: null,
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
      state.selectedClipId = clip.id;
    },
    selectClip(state, action: PayloadAction<string | null>) {
      state.selectedClipId = action.payload;
    },
updateClip(
      state,
      action: PayloadAction<{ id: string; patch: ClipPatch }>,
    ) {
      const clip = findClip(state, action.payload.id);
      if (!clip) return;
      const { patch } = action.payload;
      if (patch.name !== undefined) clip.name = patch.name;
      // The invariants ("never before 0:00", "never shorter than we can draw")
      // live HERE rather than in the properties form. Any future caller — a
      // drag in M7, a pasted project file in M9 — gets them for free, and the
      // form is left to worry only about what the user typed.
      if (patch.start !== undefined) {
        clip.start = Math.max(0, patch.start);
      }
      if (patch.duration !== undefined) {
        clip.duration = Math.max(MIN_CLIP_DURATION, patch.duration);
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
    },
    deleteClip(state, action: PayloadAction<string>) {
      for (const track of state.tracks) {
        track.clips = track.clips.filter((c) => c.id !== action.payload);
      }
      if (state.selectedClipId === action.payload) state.selectedClipId = null;
    },
  },
});

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
  updateClip,
  deleteClip,
} = timelineSlice.actions;

export default timelineSlice.reducer;