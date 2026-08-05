import type { RootState } from "@/store/store";

export const selectSystem = (state: RootState) => state.system;
export const selectBackend = (state: RootState) => state.system.backend;
export const selectAppName = (state: RootState) => state.system.appName;
export const selectAppVersion = (state: RootState) => state.system.appVersion;
