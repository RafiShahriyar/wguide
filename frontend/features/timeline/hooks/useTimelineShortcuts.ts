// frontend/features/timeline/hooks/useTimelineShortcuts.ts

"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { selectPlayer } from "@/features/player/playerSelectors";
import {
  selectSelectedClipIds,
  selectTracks,
} from "@/features/timeline/timelineSelectors";
import {
  deleteClips,
  duplicateClips,
  moveClips,
} from "@/features/timeline/timelineSlice";
import { isTypingTarget } from "@/utils/isTypingTarget";

// Keyboard editing for whatever is selected on the timeline. A sibling of
// usePlayerShortcuts, and like it, it only ever dispatches — no DOM work.

// How far a nudge moves a clip. 0.1s is roughly three frames at 30fps: fine enough
// to line an overlay up against a moment in the footage by ear, coarse enough that
// holding the key does something visible.
const NUDGE_SECONDS = 0.1;
const NUDGE_SECONDS_LARGE = 1;

export function useTimelineShortcuts() {
  const dispatch = useAppDispatch();
  const selectedClipIds = useAppSelector(selectSelectedClipIds);
  const tracks = useAppSelector(selectTracks);
  const { duration } = useAppSelector(selectPlayer);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      // Every shortcut here acts on the selection, so with nothing selected there
      // is nothing to do — and, importantly, no key to swallow. Backspace still
      // reaches the browser, Ctrl+D still bookmarks.
      if (selectedClipIds.length === 0) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        dispatch(deleteClips(selectedClipIds));
        return;
      }

      // Ctrl/Cmd+D. preventDefault is not optional: the browser's own Ctrl+D is
      // "bookmark this page", and without it you get a bookmark dialog every time.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        dispatch(
          duplicateClips({ ids: selectedClipIds, videoDuration: duration }),
        );
        return;
      }

      // Nudge with , and . — deliberately NOT the arrow keys, which
      // usePlayerShortcuts already uses for ±5s and (with Shift) ±0.1s seeking.
      // Two handlers on one window both calling preventDefault would leave which
      // one "wins" up to listener registration order, which is not a design.
      // `,` and `.` sit next to each other on the keyboard and are free.
      if (event.key === "," || event.key === ".") {
        event.preventDefault();
        const step = event.shiftKey ? NUDGE_SECONDS_LARGE : NUDGE_SECONDS;
        const deltaSeconds = event.key === "," ? -step : step;

        // Reuse moveClips rather than adding a nudge action: a nudge IS a group
        // move with a keyboard-sized delta, and it inherits the shared-delta clamp
        // that keeps the group's spacing when one member hits an end.
        const selected = new Set(selectedClipIds);
        const moves = tracks
          .flatMap((track) => track.clips)
          .filter((clip) => selected.has(clip.id))
          .map((clip) => ({ id: clip.id, fromStart: clip.start }));

        dispatch(moveClips({ moves, deltaSeconds, videoDuration: duration }));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, selectedClipIds, tracks, duration]);
}
