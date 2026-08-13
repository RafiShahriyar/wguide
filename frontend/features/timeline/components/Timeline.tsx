// frontend/features/timeline/components/Timeline.tsx

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { selectPlayer } from "@/features/player/playerSelectors";
import { selectTimeline } from "@/features/timeline/timelineSelectors";
import { formatTime } from "@/features/player/formatTime";
import { seekTo } from "@/features/player/playerSlice";
import {
  clampViewport,
  fitToWindow,
  moveClips,
  panBy,
  selectClip,
  selectClipRange,
  toggleClipSelection,
  updateClip,
  zoomAt,
} from "@/features/timeline/timelineSlice";
import {
  clipRect,
  isRectVisible,
  timeToX,
  visibleTicks,
  xToTime,
} from "@/features/timeline/timelineCoords";
import { clamp } from "@/utils/clamp";
import { MIN_CLIP_DURATION } from "@/features/timeline/newClip";
import {
  SNAP_PX,
  collectSnapTargets,
  snapMovedClip,
  snapTime,
} from "@/features/timeline/snapping";
import { ClipBlock, type ClipGesture } from "./ClipBlock";
import { TimelineToolbar } from "./TimelineToolbar";

// Height of one track lane, in px. Tracks stack downwards from the ruler.
const TRACK_HEIGHT = 28;

export function Timeline() {
  const dispatch = useAppDispatch();
  // Playhead position = the video's clock (mirrored in Redux). The element is
  // still the source of truth — we just *read* the mirrored currentTime.
  // `duration` and `sourceUrl` come along for the viewport limits below.
  const { currentTime, duration, sourceUrl, status } =
    useAppSelector(selectPlayer);
  // Viewport (zoom + pan) AND the overlay data both come from the timeline
  // slice — the view half and the data half, as laid out in Step 1.
  const { zoom, viewportStart, tracks, selectedClipIds } =
    useAppSelector(selectTimeline);

  const rootRef = useRef<HTMLDivElement>(null);
  // How wide (px) the timeline actually is. Starts at 0 and gets measured.
  const [width, setWidth] = useState(0);
  // True while the user is dragging the playhead. A ref, not state, because it
  // must not cause re-renders mid-drag.
  const scrubbing = useRef(false);
  // Which moment a clip edge is currently snapped to, so we can draw a guide
  // line there. State, not a ref, precisely BECAUSE it has to render — the
  // opposite call from `scrubbing` above, for the opposite reason.
  const [snapGuide, setSnapGuide] = useState<number | null>(null);
  // Where every moving clip started, captured on the FIRST move of a gesture
  // rather than on pointerdown.
  //
  // That timing is deliberate and worth understanding. pointerdown also dispatches
  // the selection change, and at that instant this component's props are still the
  // PRE-click selection — so snapshotting there would capture whatever was selected
  // a moment ago. Waiting for the first move means the re-render has happened and
  // `selectedClipIds` is what the user actually has selected now.
  const groupOrigins = useRef<Map<string, number> | null>(null);

  // Measure and keep `width` correct on any resize (divider drag, window).
  useLayoutEffect(() => {
    const el = rootRef.current!;
    function update() {
      setWidth(el.clientWidth);
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The two numbers the reducer can't see: the video's length (player slice)
  // and our measured width (DOM). Every viewport dispatch carries them.
  const bounds = { duration, width };

  // Keep the viewport legal. Two jobs in one effect:
  //   • a NEW video (sourceUrl changed) → fit it to the window once
  //   • anything else changed (width, duration) → just re-clamp
  // `fittedFor` remembers which video we've already fitted, so a later resize
  // can't yank the user's zoom back out from under them.
  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (width <= 0) return;
    if (sourceUrl && duration > 0 && fittedFor.current !== sourceUrl) {
      fittedFor.current = sourceUrl;
      dispatch(fitToWindow({ bounds: { duration, width } }));
      return;
    }
    dispatch(clampViewport({ bounds: { duration, width } }));
  }, [dispatch, sourceUrl, duration, width]);

  const ticks = visibleTicks(viewportStart, width, zoom);
  const playheadX = timeToX(currentTime, viewportStart, zoom);
  const hasClips = tracks.some((track) => track.clips.length > 0);

  // Convert a pointer position into an Absolute second and seek there.
  function scrubTo(event: React.PointerEvent<HTMLDivElement>) {
    if (status !== "ready") return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    dispatch(seekTo(xToTime(localX, viewportStart, zoom)));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Pressing empty timeline space clears the selection. A ClipBlock stops
    // propagation, so clicking a clip never reaches this and stays selected.
    dispatch(selectClip(null));
    if (status !== "ready") return;
    scrubbing.current = true;
    // Route all pointer events to this element until release — the drag stays
    // alive even if the cursor leaves the timeline.
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubTo(event);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (scrubbing.current) {
      scrubTo(event);
    }
  }

  function endScrub() {
    scrubbing.current = false;
  }

  // What a click on a block means. ClipBlock reports the keys; the policy is here,
  // where the current selection is visible.
  function onClipSelect(
    id: string,
    modifiers: { toggle: boolean; range: boolean },
  ) {
    if (modifiers.range) {
      dispatch(selectClipRange(id));
      return;
    }
    if (modifiers.toggle) {
      dispatch(toggleClipSelection(id));
      return;
    }
    // A plain click on a clip that is ALREADY part of a multi-selection keeps the
    // group, so that pressing on one member and dragging moves them all. Replacing
    // the selection here would collapse the group to one clip the instant you
    // touched it, making a group drag impossible.
    if (!selectedClipIds.includes(id)) dispatch(selectClip(id));
  }

  function onClipGestureEnd() {
    setSnapGuide(null);
    // Forget the snapshot so the next gesture takes a fresh one.
    groupOrigins.current = null;
  }

  // A clip is being dragged or trimmed. ClipBlock owns the gesture and hands us
  // pixels; the conversion to seconds belongs here, because `zoom` does.
  //
  // `xToTime` converts an ABSOLUTE pixel position and therefore needs
  // `viewportStart`. This converts a DELTA, so there is no viewportStart term at
  // all — which is exactly why panning mid-gesture cannot make the clip jump.
  //
  // `videoDuration` rides along on every dispatch: M6 Step 6 left it optional
  // with a note that M7's drag must pass it, and these are those callers. Nothing
  // about clamping start into the footage lives here — the reducer owns it.
  function onClipGestureBy({
    id,
    gesture,
    origin,
    deltaPx,
    bypassSnap,
  }: {
    id: string;
    gesture: ClipGesture;
    origin: { start: number; duration: number };
    deltaPx: number;
    bypassSnap: boolean;
  }) {
    const deltaSeconds = deltaPx / zoom;

    // The one line that makes snapping feel right: a tolerance defined in PIXELS,
    // divided by zoom to become seconds. 8px is 0.02s when zoomed to 400 px/s and
    // 0.8s at 10 px/s — so the stickiness stays constant under your hand however
    // far in or out you are. Alt sends 0, and `snapTime` treats that as "off".
    const tolerance = bypassSnap ? 0 : SNAP_PX / zoom;

    if (gesture === "move") {
      // Snapshot the whole moving group on the first move of the gesture. The
      // dragged clip is unioned in regardless of the selection, so grabbing a clip
      // always moves at least that clip — even if a Ctrl-click just toggled it off.
      if (!groupOrigins.current) {
        const moving = new Map<string, number>();
        for (const track of tracks) {
          for (const clip of track.clips) {
            if (selectedClipIds.includes(clip.id)) moving.set(clip.id, clip.start);
          }
        }
        if (!moving.has(id)) moving.set(id, origin.start);
        groupOrigins.current = moving;
      }
      const moving = groupOrigins.current;

      // Snapping follows the clip UNDER THE CURSOR, and the delta it produces is
      // then applied to everyone. That is why the whole group is excluded from the
      // targets: a group must not snap to its own members.
      const targets = collectSnapTargets({
        tracks,
        excludeClipIds: moving.keys(),
        playhead: currentTime,
        videoDuration: duration,
      });
      const draggedOrigin = moving.get(id) ?? origin.start;
      const snapped = snapMovedClip(
        draggedOrigin + deltaSeconds,
        origin.duration,
        targets,
        tolerance,
      );
      setSnapGuide(snapped.guide);

      // Note what is dispatched: the DELTA the dragged clip actually ended up
      // taking, not its absolute new start. Everyone else moves by the same amount,
      // which is what keeps the group's shape.
      dispatch(
        moveClips({
          moves: [...moving].map(([clipId, fromStart]) => ({
            id: clipId,
            fromStart,
          })),
          deltaSeconds: snapped.time - draggedOrigin,
          videoDuration: duration,
        }),
      );
      return;
    }

    // Resizes only ever affect the clip under the cursor, so the rest of the
    // selection is irrelevant — only this clip is excluded from the targets.
    const targets = collectSnapTargets({
      tracks,
      excludeClipIds: [id],
      playhead: currentTime,
      videoDuration: duration,
    });

    if (gesture === "resize-right") {
      // Snap the clip's END — that is the edge under the cursor — then work back
      // to a length. The reducer's MIN_CLIP_DURATION floor and its "not past the
      // end of the footage" ceiling both still apply without help from here.
      const snapped = snapTime(
        origin.start + origin.duration + deltaSeconds,
        targets,
        tolerance,
      );
      setSnapGuide(snapped.guide);
      dispatch(
        updateClip({
          id,
          patch: { duration: snapped.time - origin.start },
          videoDuration: duration,
        }),
      );
      return;
    }

    // resize-left: the interesting end. Dragging the left edge must change start
    // AND duration together so the clip's END stays exactly where it was.
    //
    // The clamp has to happen HERE, before the pair is built, and the reason is
    // worth pausing on. "start >= 0" is a rule about the DATA, so it lives in the
    // reducer and every writer inherits it. "this gesture keeps the end fixed" is
    // a rule about the GESTURE — the reducer only ever sees two numbers and cannot
    // know which of them you meant to hold still.
    //
    // Compute start naively and let the reducer clamp it and the bug is easy to
    // miss: a clip at start 2 length 3 (ending at 5), dragged 4s left, asks for
    // start −2 and length 7. The reducer pins start to 0 but keeps length 7, so
    // the end slides from 5 to 7 and the clip grows out from under your cursor.
    // Deriving duration FROM the clamped start makes that impossible.
    const end = origin.start + origin.duration;
    const snapped = snapTime(origin.start + deltaSeconds, targets, tolerance);
    setSnapGuide(snapped.guide);
    // Snap first, THEN clamp. Snapping proposes; clamping is the last word — so a
    // target inside the forbidden zone (before 0, or closer than the minimum
    // length to the fixed end) cannot pull the clip somewhere illegal.
    const nextStart = clamp(snapped.time, 0, end - MIN_CLIP_DURATION);
    dispatch(
      updateClip({
        id,
        patch: { start: nextStart, duration: end - nextStart },
        videoDuration: duration,
      }),
    );
  }

  // Wheel: horizontal motion (or Shift held) pans; vertical motion zooms,
  // anchored at the cursor so the second under the mouse stays put.
  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const localX = event.clientX - rect.left;

    const isHorizontal =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
    if (isHorizontal) {
      // Convert the scroll distance (px) into seconds at the current zoom.
      const deltaX = event.deltaX || event.deltaY;
      dispatch(panBy({ seconds: deltaX / zoom, bounds }));
    } else {
      // Steepness of the zoom curve: ~1.0015 per wheel notch feels smooth.
      const factor = Math.pow(1.0015, -event.deltaY);
      dispatch(zoomAt({ factor, anchorX: localX, bounds }));
    }
  }

  return (
    // The toolbar lives OUTSIDE the pointer-handling area on purpose: buttons
    // that sat inside it would each need stopPropagation to avoid also
    // scrubbing the playhead. Moving them out removes the problem entirely.
    <div className="flex h-full flex-col bg-zinc-950">
      <TimelineToolbar width={width} />

      <div
        ref={rootRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onWheel={onWheel}
        className="relative flex min-h-0 flex-1 touch-none flex-col overflow-hidden"
      >
        {/* Ruler — draws the adaptive ticks + labels */}
        <div className="relative h-6 shrink-0 overflow-hidden border-b border-zinc-800 bg-zinc-900">
          {ticks.map((t) => (
            <div
              key={`tick-${t}`}
              className="absolute bottom-0 h-2 border-l border-zinc-600"
              style={{ left: timeToX(t, viewportStart, zoom) }}
            />
          ))}
          {ticks.map((t) => (
            <span
              key={`label-${t}`}
              className="absolute bottom-0 px-1 font-mono text-[9px] text-zinc-500"
              style={{ left: timeToX(t, viewportStart, zoom) }}
            >
              {formatTime(t)}
            </span>
          ))}
        </div>

        {/* Tracks area — one lane per track; every clip is placed by its time */}
        <div className="relative flex-1 overflow-hidden bg-zinc-950/20">
          {tracks.map((track, trackIndex) => (
            <div
              key={track.id}
              className="absolute inset-x-0 border-b border-zinc-800/60"
              style={{ top: trackIndex * TRACK_HEIGHT, height: TRACK_HEIGHT }}
            >
              {track.clips.map((clip) => {
                // Seconds → pixels. Exactly the same viewport numbers the ruler
                // and playhead use, which is why clips stay glued to the ruler
                // through any zoom or pan without extra work.
                const rect = clipRect(
                  clip.start,
                  clip.duration,
                  viewportStart,
                  zoom,
                );
                // Off-screen clips are skipped entirely (no DOM node at all).
                if (!isRectVisible(rect, width)) return null;
                return (
                  <ClipBlock
                    key={clip.id}
                    clip={clip}
                    x={rect.x}
                    width={rect.width}
                    selected={selectedClipIds.includes(clip.id)}
                    onSelect={onClipSelect}
                    onGestureBy={onClipGestureBy}
                    onGestureEnd={onClipGestureEnd}
                  />
                );
              })}
            </div>
          ))}

          {status === "ready" && !hasClips && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-zinc-600">
              Park the playhead, then add an overlay with + Keys or + Text
            </p>
          )}
        </div>

        {/* Snap guide — shows WHAT an edge has stuck to, which is the difference
            between snapping that feels helpful and snapping that feels like the
            clip is fighting you. Drawn under the playhead so the two are
            distinguishable when a clip snaps to the playhead itself. */}
        {snapGuide !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-amber-400/90"
            style={{ left: timeToX(snapGuide, viewportStart, zoom) }}
          />
        )}

        {/* Playhead — a thin vertical line over the whole timeline */}
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-red-500/80"
          style={{ left: playheadX }}
        />
      </div>
    </div>
  );
}