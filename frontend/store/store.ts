import { configureStore } from "@reduxjs/toolkit";
import systemReducer from "@/features/system/systemSlice";
import layoutReducer from "@/features/layout/layoutSlice";

export const store = configureStore({
  reducer: {
    system: systemReducer,
    layout: layoutReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
