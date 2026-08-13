// frontend/features/player/hooks/usePlayerShortcuts.ts

"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import {
  requestPick,
  seekBy,
  setPlaying,
} from "@/features/player/playerSlice";
import { selectPlayer } from "@/features/player/playerSelectors";
import { isTypingTarget } from "@/utils/isTypingTarget";

// The app-wide keyboard controls. It only talks to the store; VideoPlayer's
// effects turn the state changes into element actions (play/pause/seek).
export function usePlayerShortcuts() {
  const dispatch = useAppDispatch();
  const { status, isPlaying } = useAppSelector(selectPlayer);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Never hijack keys while the user is typing in a form control.
      if (isTypingTarget(event.target)) return;

      // Space = play/pause. Only meaningful once a video is loaded.
      if (event.key === " ") {
        event.preventDefault();
        if (status === "ready") {
          dispatch(setPlaying(!isPlaying));
        }
        return;
      }

      // ← / → = ±5 seconds (also nudge in 0.1s when Shift held).
      if (event.key === "ArrowRight") {
        event.preventDefault();
        dispatch(seekBy(event.shiftKey ? 0.1 : 5));
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        dispatch(seekBy(event.shiftKey ? -0.1 : -5));
        return;
      }

      // Ctrl/Cmd+O = open a video (same signal the menu uses).
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        dispatch(requestPick());
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, status, isPlaying]);
}