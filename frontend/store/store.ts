import { configureStore } from "@reduxjs/toolkit";
import systemReducer from "@/features/system/systemSlice";
import layoutReducer from "@/features/layout/layoutSlice";
import playerReducer from "@/features/player/playerSlice";

export const store = configureStore({
  reducer: {
    system: systemReducer,
    layout: layoutReducer,
    player: playerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
