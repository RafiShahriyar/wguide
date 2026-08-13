import type { RootState } from "@/store/store";
import type { OverlayClip } from "./types";

export const selectTimeline = (state: RootState) => state.timeline;
export const selectZoom = (state: RootState) => state.timeline.zoom;
export const selectViewportStart = (state: RootState) =>
  state.timeline.viewportStart;
export const selectTracks = (state: RootState) => state.timeline.tracks;
// Returns the array that already lives in the store, so its identity only changes
// when the selection genuinely changes. Building a fresh array here — with a
// `.map` or a `.filter` — would hand `useSelector` a new reference on every single
// store update and re-render every consumer forever.
export const selectSelectedClipIds = (state: RootState) =>
  state.timeline.selectedClipIds;

// A DERIVED selector: the store holds only ids, and this walks the tracks to find
// the clip one names. It needs no memoisation because it returns the very object
// already living in the store — same reference every call until that clip actually
// changes, which is exactly what React's re-render check wants.
//
// "Sole" is the point: it answers null unless EXACTLY one clip is selected. The
// full properties form edits one clip's name, start and length, and there is no
// sensible meaning for typing one Start into five clips at once — so multi-select
// gets a different, smaller UI rather than a form that silently does the wrong
// thing. Encoding that rule in the selector means the panel cannot get it wrong.
export const selectSoleSelectedClip = (state: RootState): OverlayClip | null => {
  const { tracks, selectedClipIds } = state.timeline;
  if (selectedClipIds.length !== 1) return null;
  const [onlyId] = selectedClipIds;
  for (const track of tracks) {
    const found = track.clips.find((clip) => clip.id === onlyId);
    if (found) return found;
  }
  return null;
};