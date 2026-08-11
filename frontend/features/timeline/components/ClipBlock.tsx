// frontend/features/timeline/components/ClipBlock.tsx

"use client";

import { formatTime } from "@/features/player/formatTime";
import type { OverlayClip, OverlayKind } from "@/features/timeline/types";

// One overlay drawn as a block in a track lane.
//
// This component is deliberately "dumb": it does NO time↔pixel math and reads
// nothing from the store. The parent already computed where the block goes and
// hands it down as plain props. That keeps all the coordinate logic in one
// place (Timeline + timelineCoords) instead of scattered across the tree.

// Colour per kind, so you can tell overlays apart at a glance. Extracted as a
// lookup rather than an if/else so adding "arrow"/"image" later is one line —
// and TypeScript will complain here the moment a new OverlayKind is added.
const KIND_STYLES: Record<OverlayKind, string> = {
  keyboard: "border-emerald-400/70 bg-emerald-600/70 hover:bg-emerald-600/90",
  text: "border-sky-400/70 bg-sky-600/70 hover:bg-sky-600/90",
};

interface ClipBlockProps {
  clip: OverlayClip;
  x: number; // px from the timeline's left edge
  width: number; // px
  selected: boolean;
  onSelect: (id: string) => void;
}

export function ClipBlock({
  clip,
  x,
  width,
  selected,
  onSelect,
}: ClipBlockProps) {
  const end = clip.start + clip.duration;

  return (
    <button
      type="button"
      // stopPropagation matters: the timeline root owns onPointerDown for
      // playhead scrubbing. Without this, selecting a clip would also yank the
      // video to wherever you clicked.
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect(clip.id);
      }}
      style={{ left: x, width }}
      title={`${clip.name} — ${formatTime(clip.start)} → ${formatTime(end)}`}
      className={[
        "absolute top-1 bottom-1 flex items-center overflow-hidden rounded border px-1 text-left text-[10px] text-white/90",
        KIND_STYLES[clip.kind],
        selected ? "ring-1 ring-white/80" : "",
      ].join(" ")}
    >
      <span className="truncate">{clip.name}</span>
    </button>
  );
}
