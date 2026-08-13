// frontend/features/timeline/components/MultiClipInspector.tsx

"use client";

import { useAppDispatch } from "@/hooks/useRedux";
import { deleteClips, selectClip } from "@/features/timeline/timelineSlice";

// What the Properties panel shows when SEVERAL clips are selected.
//
// Deliberately not the full form. "Start" and "Length" and "Text" are properties
// of one clip; typing a single Start into five clips at once has no meaning that
// is obviously right — should they all begin together, or keep their spacing and
// shift as a group? The second is what dragging already does, so the form does not
// try to guess. What IS unambiguous for a group is shown, and nothing else.
export function MultiClipInspector({ ids }: { ids: string[] }) {
  const dispatch = useAppDispatch();

  return (
    <div className="flex flex-col gap-3">
      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
        {ids.length} clips selected
      </span>

      <p className="text-xs leading-relaxed text-zinc-500">
        Drag any one of them on the timeline to move the whole group. Ctrl-click a
        clip to add or remove it, Shift-click to select a range.
      </p>

      <button
        type="button"
        onClick={() => dispatch(deleteClips(ids))}
        className="rounded border border-red-900 px-2 py-1 text-[10px] text-red-400 hover:bg-red-950"
      >
        Delete {ids.length} clips
      </button>

      <button
        type="button"
        // `selectClip(null)` clears; passing null rather than adding a second
        // action keeps one way to say "nothing is selected".
        onClick={() => dispatch(selectClip(null))}
        className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800"
      >
        Clear selection
      </button>
    </div>
  );
}
