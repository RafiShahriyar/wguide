// frontend/features/player/playerSlice.ts

import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export interface PlayerState {
  // "empty" = no video open yet; "ready" = one is loaded and playable.
  status: "empty" | "ready";
  fileName: string | null;
  // An object URL (`URL.createObjectURL`) pointing at the picked file.
  sourceUrl: string | null;
  isPlaying: boolean;
  currentTime: number; // seconds, mirrored from the <video> element
  duration: number; // seconds, 0 until metadata loads
  // Every time this bumps, the picker component opens the file dialog.
  // It's a "signal" counter, not real data.
  pickRequest: number;
}

const initialState: PlayerState = {
  status: "empty",
  fileName: null,
  sourceUrl: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  pickRequest: 0,
};

const playerSlice = createSlice({
  name: "player",
  initialState,
  reducers: {
    // Called by the picker after a file is chosen. The picker is also
    // responsible for revoking the previous object URL (a side effect, so it
    // must NOT happen inside a reducer).
    videoOpened(
      state,
      action: PayloadAction<{ fileName: string; sourceUrl: string }>,
    ) {
      state.status = "ready";
      state.fileName = action.payload.fileName;
      state.sourceUrl = action.payload.sourceUrl;
      state.isPlaying = false;
      state.currentTime = 0;
      state.duration = 0;
    },
    clearVideo(state) {
      state.status = "empty";
      state.fileName = null;
      state.sourceUrl = null;
      state.isPlaying = false;
      state.currentTime = 0;
      state.duration = 0;
    },
    // The menu bar can't open a file dialog itself — it just bumps this and
    // the component that owns the <input> reacts to the change.
    requestPick(state) {
      state.pickRequest += 1;
    },
    setPlaying(state, action: PayloadAction<boolean>) {
      state.isPlaying = action.payload;
    },
    setTime(state, action: PayloadAction<number>) {
      state.currentTime = action.payload;
    },
    setDuration(state, action: PayloadAction<number>) {
      state.duration = action.payload;
    },
  },
});

export const {
  videoOpened,
  clearVideo,
  requestPick,
  setPlaying,
  setTime,
  setDuration,
} = playerSlice.actions;

export default playerSlice.reducer;
