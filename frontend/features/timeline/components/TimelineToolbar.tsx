// frontend/features/timeline/components/TimelineToolbar.tsx

"use client";

import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { selectPlayer } from "@/features/player/playerSelectors";
import { addClip, fitToWindow } from "@/features/timeline/timelineSlice";
import { makeNewClip } from "@/features/timeline/newClip";
import { formatTime } from "@/features/player/formatTime";
import type { OverlayKind } from "@/features/timeline/types";

// The strip above the ruler: add an overlay at the playhead, or fit the view.
//
// It takes exactly ONE prop — `width`. Everything else (currentTime, duration,
// status) it reads from the store itself. `width` is the only number that
// isn't in the store: it is measured from the DOM by the Timeline component,
// so it has to be handed down.

const BUTTON =
  "rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800";

export function TimelineToolbar({ width }: { width: number }) {
  const dispatch = useAppDispatch();
  const { currentTime, duration, status } = useAppSelector(selectPlayer);
  const ready = status === "ready";

  // The whole point of the milestone: a new clip starts at the playhead, in
  // SECONDS, straight from the player's clock. No pixels are involved — where
  // the timeline happens to be zoomed or scrolled makes no difference at all.
  function add(kind: OverlayKind) {
    dispatch(addClip(makeNewClip(kind, currentTime, duration)));
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-800 bg-zinc-900 px-2 py-1">
      <button
        type="button"
        disabled={!ready}
        onClick={() => add("keyboard")}
        title="Add a keycap overlay at the playhead"
        className={BUTTON}
      >
        + Keys
      </button>
      <button
        type="button"
        disabled={!ready}
        onClick={() => add("text")}
        title="Add a text overlay at the playhead"
        className={BUTTON}
      >
        + Text
      </button>

      <span className="ml-1 font-mono text-[10px] text-zinc-500">
        at {formatTime(currentTime)}
      </span>

      <button
        type="button"
        disabled={!ready}
        onClick={() => dispatch(fitToWindow({ bounds: { duration, width } }))}
        title="Fit the whole video in the timeline"
        className={`${BUTTON} ml-auto`}
      >
        Fit
      </button>
    </div>
  );
}
