// frontend/utils/clamp.ts

// Keep a number within [min, max]. Used by PanelDivider so a panel can't be
// dragged to zero (or past a sensible width).
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
