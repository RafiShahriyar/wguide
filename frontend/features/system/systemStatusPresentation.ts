// frontend/features/system/systemStatusPresentation.ts

import type { BackendStatus } from "./systemSlice";

export interface StatusPresentation {
  label: string;
  dot: string;
  text: string;
}

// Shared by SystemStatusCard and StatusBar so the status → style mapping
// lives in exactly one place.
export const STATUS_PRESENTATION: Record<BackendStatus, StatusPresentation> = {
  idle: { label: "Not checked", dot: "bg-zinc-500", text: "text-zinc-400" },
  checking: { label: "Checking…", dot: "bg-amber-400", text: "text-amber-300" },
  connected: {
    label: "Connected",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
  },
  error: { label: "Unreachable", dot: "bg-red-400", text: "text-red-300" },
};