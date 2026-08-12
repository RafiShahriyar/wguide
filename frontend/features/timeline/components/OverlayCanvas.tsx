// frontend/features/timeline/components/OverlayCanvas.tsx

"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { selectPlayer } from "@/features/player/playerSelectors";
import { selectTracks } from "@/features/timeline/timelineSelectors";
import { selectClip, updateClip } from "@/features/timeline/timelineSlice";
import { activeClipsAt } from "@/features/timeline/activeClips";
import { clipOpacityAt } from "@/features/timeline/clipOpacity";
import { draggedPosition } from "@/features/timeline/overlayCoords";
import type { OverlayClip } from "@/features/timeline/types";

// The overlays drawn on top of the video preview.
//
// It must line up with the VIDEO, not with the black panel around it. A 16:9
// recording inside a wider panel leaves black bars on the sides; anchoring to
// the panel would float the overlays out over those bars, and M8's export —
// which only knows about the video frame — would then disagree with what you
// saw here. So we measure the <video> element's own box and match it exactly.

interface FrameRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// The frame height the Tailwind sizes below were designed against in M5.
//
// Every overlay is scaled by `frame.height / REFERENCE_FRAME_HEIGHT`, so at a
// 450px-tall preview the factor is exactly 1 and the overlays look precisely as
// they did before this step. On a 1080px-tall frame the factor is 2.4 and
// EVERYTHING grows together — text, padding, border thickness — because a CSS
// `scale` transform scales the whole rendered box, not just the font.
//
// Height, not width: a 21:9 ultrawide recording is much wider than a 16:9 one
// at the same height, and scaling off width would shrink every overlay on it.
const REFERENCE_FRAME_HEIGHT = 450;

export function OverlayCanvas({
  videoRef,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const { currentTime } = useAppSelector(selectPlayer);
  const tracks = useAppSelector(selectTracks);
  const [frame, setFrame] = useState<FrameRect | null>(null);

  // Track where the video's box actually is. Two observers, because the two
  // things can change independently: the video resizes when its metadata loads
  // or the panel gets taller, but it also SLIDES sideways when the panel width
  // changes while the video's own size stays the same (it is centred).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const container = video.parentElement;

    function measure() {
      const el = videoRef.current;
      if (!el) return;
      // offsetLeft/offsetTop are relative to the nearest positioned ancestor,
      // which is the `relative` container the video sits in — exactly the box
      // this component is absolutely positioned inside.
      setFrame({
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(video);
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, [videoRef]);

  const active = activeClipsAt(tracks, currentTime);
  if (!frame || active.length === 0) return null;

  // How much bigger (or smaller) this frame is than the size the overlay styles
  // were designed for. Measured once here and handed to every item, rather than
  // each item reading the frame itself.
  const frameScale = frame.height / REFERENCE_FRAME_HEIGHT;

  return (
    // Still pointer-events-none so the overlays never swallow clicks meant for
    // the video. Step 3 gives each item back its own pointer events so it can be
    // dragged — selectively, one item at a time, never by removing this.
    //
    // The flex column that used to stack everything bottom-centre is gone: each
    // item now positions ITSELF from its own transform, so two overlays live at
    // the same moment can sit in completely different places.
    <div className="pointer-events-none absolute" style={frame}>
      {active.map((clip) => (
        <OverlayItem
          key={clip.id}
          clip={clip}
          frame={frame}
          frameScale={frameScale}
          // Computed here rather than inside the item: the envelope depends on
          // the CLOCK, and this component is already the one place where the
          // player's time and the timeline's clips meet.
          opacity={clipOpacityAt(clip, currentTime)}
        />
      ))}
    </div>
  );
}

// One overlay, placed by its own transform and drawn according to its kind.
// Because OverlayClip is a proper discriminated union, checking `clip.kind`
// narrows `clip.props` for us — no optional fields, no casts.
function OverlayItem({
  clip,
  frame,
  frameScale,
  opacity,
}: {
  clip: OverlayClip;
  frame: FrameRect;
  frameScale: number;
  // The already-faded opacity for this instant. Note we do NOT read
  // `clip.transform.opacity` below — that is the base value the envelope has
  // already been multiplied into.
  opacity: number;
}) {
  const dispatch = useAppDispatch();
  const { x, y, scale, rotation } = clip.transform;

  // Refs, not state: these change on every pointer move and nothing renders
  // from them directly. Same reasoning as PanelDivider — and the same reason we
  // record the START of the gesture. Each dispatch re-renders this component, so
  // reading "where is the overlay now" mid-drag would chase its own tail. We
  // instead remember where it began and add the TOTAL movement since.
  const dragging = useRef(false);
  const dragStart = useRef({ pointerX: 0, pointerY: 0, x: 0, y: 0 });

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Without this the browser begins its own text-selection drag and the
    // overlay stutters as the two gestures fight each other.
    event.preventDefault();
    dragging.current = true;
    dragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: clip.transform.x,
      y: clip.transform.y,
    };
    // Every later pointer event for this finger/mouse now comes to THIS element,
    // even when the cursor outruns it. Exactly what keeps a fast drag alive.
    event.currentTarget.setPointerCapture(event.pointerId);
    // Grabbing an overlay selects it, so the Properties panel always shows the
    // thing you are touching.
    dispatch(selectClip(clip.id));
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const next = draggedPosition(
      { x: dragStart.current.x, y: dragStart.current.y },
      {
        dx: event.clientX - dragStart.current.pointerX,
        dy: event.clientY - dragStart.current.pointerY,
      },
      frame,
    );
    // Spread the existing transform so scale/rotation/opacity survive: the patch
    // carries a WHOLE ClipTransform, which is the convention `props` set.
    dispatch(
      updateClip({
        id: clip.id,
        patch: { transform: { ...clip.transform, ...next } },
      }),
    );
  }

  function endDrag() {
    dragging.current = false;
  }

  // THE ORDER OF THESE THREE TRANSFORMS MATTERS. A CSS transform list applies
  // right-to-left, and `transform-origin` defaults to the element's own centre,
  // which is what makes this particular order work:
  //
  //   scale(…)               grows the box about its centre — centre unmoved
  //   rotate(…)              spins it about its centre     — centre unmoved
  //   translate(-50%, -50%)  shifts it by half its OWN size, moving its centre
  //                          onto the (left, top) point below
  //
  // So `left`/`top` place the element's top-left corner at (x, y) of the frame,
  // and the translate slides it back by half its size — landing its CENTRE
  // exactly on (x, y). Rotation and scale then happen about that centre, which
  // is decision #3: an overlay rotates in place instead of swinging away.
  //
  // Write it the other way round — scale(…) rotate(…) translate(-50%, -50%) —
  // and the translate happens FIRST, so the scale multiplies the -50% shift too.
  // A 100px-wide overlay at scale 2 would move back 100px instead of 50px, and
  // every overlay would sit half its width off-target, worsening as you scale.
  const style: CSSProperties = {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale * frameScale})`,
    opacity,
  };

  return (
    // whitespace-nowrap because the element has no width of its own: near the
    // right-hand edge of the frame a long caption would otherwise wrap into a
    // tall block and its centre would no longer be where the maths says it is.
    //
    // pointer-events-auto is the SELECTIVE lift: the container stays
    // pointer-events-none so the video keeps receiving clicks everywhere except
    // on an actual overlay. Removing it from the container instead would make the
    // whole frame one big click-blocker.
    //
    // touch-none stops a touch drag being stolen by the browser to scroll the
    // page, and select-none stops the caption highlighting as you drag it.
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="pointer-events-auto absolute cursor-grab touch-none select-none whitespace-nowrap active:cursor-grabbing"
      style={style}
    >
      {clip.kind === "keyboard" ? (
        <div className="flex gap-1.5">
          {clip.props.keys.map((key, index) => (
            <span
              key={`${key}-${index}`}
              className="rounded border border-zinc-600 border-b-4 bg-zinc-900/85 px-2.5 py-1 font-mono text-sm text-zinc-100"
            >
              {key}
            </span>
          ))}
        </div>
      ) : (
        <span
          className="rounded bg-black/55 px-3 py-1 text-sm font-medium"
          style={{ color: clip.props.color }}
        >
          {clip.props.text}
        </span>
      )}
    </div>
  );
}
