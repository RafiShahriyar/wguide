// frontend/components/layout/PanelDivider.tsx

"use client";

import { useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { resizePanel } from "@/features/layout/layoutSlice";
import type { PanelName } from "@/features/layout/layoutSlice";
import { selectPanels } from "@/features/layout/layoutSelectors";
import { clamp } from "@/utils/clamp";

const MIN_SIZE = 100;
const MAX_SIZE = 800;

interface PanelDividerProps {
  // Which panel this divider controls.
  panel: PanelName;
  // "vertical" resizes width (drag left/right), "horizontal" resizes
  // height (drag up/down) — e.g. the timeline divider.
  orientation?: "vertical" | "horizontal";
}

export function PanelDivider({
  panel,
  orientation = "vertical",
}: PanelDividerProps) {
  const dispatch = useAppDispatch();
  const size = useAppSelector(selectPanels)[panel];
  const isVertical = orientation === "vertical";

  // Refs survive re-renders without causing them. We need the pointer's
  // starting X/Y AND the panel's starting size — otherwise each dispatched
  // resize (which re-renders this component) would move the drag anchor.
  const dragStart = useRef({ pos: 0, size: 0 });
  const dragging = useRef(false);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    dragStart.current = {
      pos: isVertical ? event.clientX : event.clientY,
      size,
    };
    // From now on, ALL pointer events go to THIS element — even if the
    // cursor moves outside it. This is what makes the drag not "drop" the
    // divider when you move the mouse fast.
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const currentPos = isVertical ? event.clientX : event.clientY;
    const next = dragStart.current.size + (currentPos - dragStart.current.pos);
    dispatch(resizePanel({ panel, size: clamp(next, MIN_SIZE, MAX_SIZE) }));
  }

  function endDrag() {
    dragging.current = false;
  }

  const axisClasses = isVertical
    ? "w-1.5 h-full cursor-col-resize"
    : "h-1.5 w-full cursor-row-resize";

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={`Resize ${panel} panel`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`z-10 shrink-0 select-none touch-none bg-zinc-800 transition-colors hover:bg-emerald-500/60 active:bg-emerald-500 ${axisClasses}`}
    />
  );
}
