import type { RootState } from "@/store/store";

export const selectPlayer = (state: RootState) => state.player;
