import type { RootState } from "@/store/store";
import type { OverlayClip } from "./types";

export const selectTimeline = (state: RootState) => state.timeline;
export const selectZoom = (state: RootState) => state.timeline.zoom;
export const selectViewportStart = (state: RootState) =>
  state.timeline.viewportStart;
export const selectTracks = (state: RootState) => state.timeline.tracks;
export const selectSelectedClipId = (state: RootState) =>
  state.timeline.selectedClipId;

// A DERIVED selector: the store holds only an id, and this walks the tracks to
// find the clip it names. It needs no memoisation because it returns the very
// object already living in the store — same reference every call until that
// clip actually changes, which is exactly what React's re-render check wants.
export const selectSelectedClip = (state: RootState): OverlayClip | null => {
  const { tracks, selectedClipId } = state.timeline;
  if (!selectedClipId) return null;
  for (const track of tracks) {
    const found = track.clips.find((clip) => clip.id === selectedClipId);
    if (found) return found;
  }
  return null;
};