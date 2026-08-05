// frontend/features/layout/layoutSlice.ts

import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

// The three panels we can resize. `Record<PanelName, number>` means
// "an object that has exactly these three keys, each holding a number".
export type PanelName = "assets" | "properties" | "timeline";

export interface LayoutState {
  panels: Record<PanelName, number>;
}

const DEFAULT_PANEL_SIZES: Record<PanelName, number> = {
  assets: 240,
  properties: 280,
  timeline: 180,
};

const initialState: LayoutState = {
  panels: DEFAULT_PANEL_SIZES,
};

const layoutSlice = createSlice({
  name: "layout",
  initialState,
  reducers: {
    // PayloadAction<T> tells TypeScript: "the action you must dispatch to
    // call this is { type: 'layout/resizePanel', payload: { panel, size } }".
    resizePanel(
      state,
      action: PayloadAction<{ panel: PanelName; size: number }>,
    ) {
      // This looks like mutation, but Redux Toolkit (Immer) makes it safe:
      // it creates a new state object for us. Never write like this outside
      // a slice reducer.
      state.panels[action.payload.panel] = action.payload.size;
    },
    resetLayout(state) {
      state.panels = { ...DEFAULT_PANEL_SIZES };
    },
  },
});

// Action creators — these are what components dispatch.
export const { resizePanel, resetLayout } = layoutSlice.actions;

// Default export is the reducer, registered in store/store.ts.
export default layoutSlice.reducer;
