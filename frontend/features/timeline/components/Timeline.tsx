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
  panBy,
  selectClip,
  zoomAt,
} from "@/features/timeline/timelineSlice";
import {
  clipRect,
  isRectVisible,
  timeToX,
  visibleTicks,
  xToTime,
} from "@/features/timeline/timelineCoords";
import { ClipBlock } from "./ClipBlock";
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
  const { zoom, viewportStart, tracks, selectedClipId } =
    useAppSelector(selectTimeline);

  const rootRef = useRef<HTMLDivElement>(null);
  // How wide (px) the timeline actually is. Starts at 0 and gets measured.
  const [width, setWidth] = useState(0);
  // True while the user is dragging the playhead. A ref, not state, because it
  // must not cause re-renders mid-drag.
  const scrubbing = useRef(false);

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
                    selected={clip.id === selectedClipId}
                    onSelect={(id) => dispatch(selectClip(id))}
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

        {/* Playhead — a thin vertical line over the whole timeline */}
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-red-500/80"
          style={{ left: playheadX }}
        />
      </div>
    </div>
  );
}