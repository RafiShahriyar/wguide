// frontend/features/player/components/VideoPlayer.tsx

"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import {
  setDuration,
  setPlaying,
  setTime,
} from "@/features/player/playerSlice";
import { selectPlayer } from "@/features/player/playerSelectors";
import { OverlayCanvas } from "@/features/timeline/components/OverlayCanvas";
import { TransportBar } from "./TransportBar";

export function VideoPlayer({ sourceUrl }: { sourceUrl: string }) {
  const dispatch = useAppDispatch();
  const { isPlaying, seekRequest, seekTime } = useAppSelector(selectPlayer);
  const videoRef = useRef<HTMLVideoElement>(null);

  // The <video> element is the source of truth for playback timing. Here we
  // only ATTACH listeners that MIRROR its events into the store. The element
  // itself stays in charge of the actual clock.
  useEffect(() => {
    // The ref is always attached while this effect runs (the <video> is in
    // this render), so `!` just tells TypeScript to trust that.
    const el = videoRef.current!;

    // Load the new source, THEN attach listeners. Doing both in this same
    // effect guarantees the listeners are ready before metadata fires.
    el.src = sourceUrl;

    function onLoadedMetadata() {
      dispatch(setDuration(el.duration));
    }
    function onTimeUpdate() {
      dispatch(setTime(el.currentTime));
    }
    function onPlay() {
      dispatch(setPlaying(true));
    }
    function onPause() {
      dispatch(setPlaying(false));
    }
    function onEnded() {
      dispatch(setPlaying(false));
    }

    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [sourceUrl, dispatch]);

  // The OTHER direction: when something (a button, a future keyboard
  // shortcut) changes isPlaying in the store, push that intent onto the
  // element. The element's play/pause events echo it back — no loops, because
  // setting the same state to the same value doesn't re-render.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying]);

  // The seek command bridge: when a shortcut bumped seekRequest, jump the
  // element's playhead to seekTime. Same store→element direction as isPlaying.
  useEffect(() => {
    if (seekRequest > 0) {
      const video = videoRef.current!;
      video.currentTime = seekTime;
    }
  }, [seekRequest, seekTime]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    dispatch(setTime(seconds));
  }

  return (
    <div className="flex min-h-0 h-full flex-col bg-zinc-950">
      {/* `relative` makes this the positioning parent the OverlayCanvas
          measures against, so the overlays land on the video, not the bars. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
        <video ref={videoRef} className="max-h-full max-w-full object-contain" />
        <OverlayCanvas videoRef={videoRef} />
      </div>
      <TransportBar onTogglePlay={togglePlay} onSeek={seekTo} />
    </div>
  );
}