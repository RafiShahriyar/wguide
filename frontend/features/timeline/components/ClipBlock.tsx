// frontend/features/timeline/components/ClipBlock.tsx

"use client";

import { useRef } from "react";
import { formatTime } from "@/features/player/formatTime";
import type { OverlayClip, OverlayKind } from "@/features/timeline/types";

// One overlay drawn as a block in a track lane.
//
// This component is deliberately "dumb": it does NO time↔pixel math and reads
// nothing from the store. The parent already computed where the block goes and
// hands it down as plain props. That keeps all the coordinate logic in one
// place (Timeline + timelineCoords) instead of scattered across the tree.
//
// M7 keeps that split. This component owns the GESTURE — pointer capture, the
// click-vs-drag threshold, remembering where the clip sat when you grabbed it —
// and reports the pointer's travel in PIXELS. Converting pixels to seconds needs
// `zoom`, which lives in the parent, so the parent does that and dispatches.

// How far the pointer must travel before a press counts as a drag rather than a
// click. A click and a drag begin with the identical event, so without this a
// click to select would retime the clip by a pixel or two of hand tremor — and
// would dispatch a pointless store write every time you selected something.
const MOVE_THRESHOLD_PX = 3;

// How wide the grab zone at each end of a block is.
const HANDLE_PX = 6;

// Below this width a block cannot sensibly be carved into three zones. A clip
// drawn at MIN_CLIP_WIDTH (4px, when zoomed right out) would be nothing but
// handles with no middle left, so it could never be moved. Under this width the
// whole block means "move" and the handles are not drawn at all.
const MIN_WIDTH_FOR_HANDLES = HANDLE_PX * 3;

// What the pointer is doing to this clip. Grabbing an end trims it; grabbing
// anywhere else retimes it.
export type ClipGesture = "move" | "resize-left" | "resize-right";

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
  // The block reports WHICH keys were held and lets the parent decide what that
  // means. It deliberately does not know the words "toggle" or "range" in terms of
  // selection state — it cannot see the selection, and the mapping from key to
  // meaning is a policy decision that belongs with the store.
  onSelect: (
    id: string,
    modifiers: { toggle: boolean; range: boolean },
  ) => void;
  // Reports an in-progress gesture. One object rather than five positional
  // arguments, because the call site reads as a sentence and adding a sixth fact
  // later costs nothing.
  onGestureBy: (input: {
    id: string;
    gesture: ClipGesture;
    // Where the clip sat when the gesture began — captured once, never re-read.
    origin: { start: number; duration: number };
    // How far the pointer has travelled, in PIXELS. The parent turns pixels into
    // seconds because `zoom` is its business, not ours.
    deltaPx: number;
    // Alt held: the standard editor convention for "ignore snapping this once".
    // Read per-move rather than per-gesture, so you can press or release Alt
    // mid-drag and it takes effect immediately.
    bypassSnap: boolean;
  }) => void;
  // The gesture is over. The parent uses this to clear the snap guide line — it
  // cannot infer it from onGestureBy, which only ever says "still going".
  onGestureEnd: () => void;
}

export function ClipBlock({
  clip,
  x,
  width,
  selected,
  onSelect,
  onGestureBy,
  onGestureEnd,
}: ClipBlockProps) {
  const end = clip.start + clip.duration;
  const showHandles = width >= MIN_WIDTH_FOR_HANDLES;

  // Gesture state as refs, not state: it changes on every pointer move and
  // nothing renders from it. start/duration are captured ONCE when the gesture
  // begins — reading them on each move would chase their own tail, because every
  // move dispatches and re-renders. Same trap, and same fix, as M6's overlay drag.
  const gesture = useRef<{
    pointerX: number;
    start: number;
    duration: number;
    kind: ClipGesture;
  } | null>(null);
  const isDragging = useRef(false);

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    // stopPropagation matters: the timeline root owns onPointerDown for
    // playhead scrubbing. Without this, selecting a clip would also yank the
    // video to wherever you clicked.
    event.stopPropagation();
    // metaKey as well as ctrlKey, so the gesture is Cmd-click on a Mac.
    onSelect(clip.id, {
      toggle: event.ctrlKey || event.metaKey,
      range: event.shiftKey,
    });

    // WHICH gesture is decided from coordinates, right here, rather than by
    // giving each handle its own pointerdown. That is deliberate: handles with
    // their own handlers would each need a stopPropagation to keep the block's
    // own move gesture from firing too, and "every child needs stopPropagation"
    // is the smell that moved the toolbar out of the pointer root in M4. One
    // handler, one rect, three zones — the handle <span>s below exist purely to
    // supply a cursor.
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const kind: ClipGesture = !showHandles
      ? "move"
      : offsetX <= HANDLE_PX
        ? "resize-left"
        : offsetX >= rect.width - HANDLE_PX
          ? "resize-right"
          : "move";

    gesture.current = {
      pointerX: event.clientX,
      start: clip.start,
      duration: clip.duration,
      kind,
    };
    isDragging.current = false;
    // All later pointer events come here even when the cursor outruns the block —
    // which it will, since the block can be only a few pixels wide when zoomed out.
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current) return;
    const deltaPx = event.clientX - current.pointerX;
    // Below the threshold this is still a click, so report nothing at all.
    if (!isDragging.current && Math.abs(deltaPx) < MOVE_THRESHOLD_PX) return;
    isDragging.current = true;
    onGestureBy({
      id: clip.id,
      gesture: current.kind,
      origin: { start: current.start, duration: current.duration },
      deltaPx,
      bypassSnap: event.altKey,
    });
  }

  function endGesture() {
    // Only announce the end if a drag actually happened. A plain click never
    // showed a snap guide, so telling the parent to clear one would be noise.
    if (isDragging.current) onGestureEnd();
    gesture.current = null;
    isDragging.current = false;
  }

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      style={{ left: x, width }}
      title={`${clip.name} — ${formatTime(clip.start)} → ${formatTime(end)}`}
      className={[
        "absolute top-1 bottom-1 flex items-center overflow-hidden rounded border px-1 text-left text-[10px] text-white/90",
        "cursor-grab touch-none select-none active:cursor-grabbing",
        KIND_STYLES[clip.kind],
        selected ? "ring-1 ring-white/80" : "",
      ].join(" ")}
    >
      <span className="truncate">{clip.name}</span>

      {/* Cursor affordances only — no handlers. Pointer events on these bubble
          straight up to the button, which works out which zone was grabbed from
          the coordinates. Spans rather than divs because a <button>'s content
          model is phrasing content. */}
      {showHandles && (
        <>
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize rounded-l bg-white/0 hover:bg-white/40"
          />
          <span
            aria-hidden
            className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r bg-white/0 hover:bg-white/40"
          />
        </>
      )}
    </button>
  );
}
