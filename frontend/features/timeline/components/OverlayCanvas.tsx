// frontend/features/timeline/components/OverlayCanvas.tsx

"use client";

import { useEffect, useState, type RefObject } from "react";
import { useAppSelector } from "@/hooks/useRedux";
import { selectPlayer } from "@/features/player/playerSelectors";
import { selectTracks } from "@/features/timeline/timelineSelectors";
import { activeClipsAt } from "@/features/timeline/activeClips";
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

  return (
    // pointer-events-none so the overlays never swallow clicks meant for the
    // video. Sizes are in % of the frame, so they scale with the preview.
    <div
      className="pointer-events-none absolute flex flex-col items-center justify-end gap-2 pb-[6%]"
      style={frame}
    >
      {active.map((clip) => (
        <OverlayItem key={clip.id} clip={clip} />
      ))}
    </div>
  );
}

// One overlay, drawn according to its kind. Because OverlayClip is a proper
// discriminated union, checking `clip.kind` narrows `clip.props` for us — no
// optional fields, no casts.
function OverlayItem({ clip }: { clip: OverlayClip }) {
  if (clip.kind === "keyboard") {
    return (
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
    );
  }

  return (
    <span
      className="rounded bg-black/55 px-3 py-1 text-sm font-medium"
      style={{ color: clip.props.color }}
    >
      {clip.props.text}
    </span>
  );
}
