// frontend/features/timeline/overlayCoords.ts

// Turning pointer movement into overlay geometry.
//
// This is the MIRROR of `xToTime` in timelineCoords.ts. There, a pixel offset is
// divided by `zoom` (pixels per second) to get seconds. Here, a pixel offset is
// divided by the frame's size in pixels to get a 0–1 share of the frame. The
// same move both times: screen space → data space, by dividing by "how many
// pixels one unit of data is worth".
//
// Pure and React-free like every other coordinate helper, so M7's snapping and
// M8's exporter can reuse it and get the same answers the editor gave.

export interface FrameSize {
  width: number;
  height: number;
}

// Dividing pixels by pixels gives long floating-point tails: dragging can easily
// land on 0.30124999999999996. Rounding to four decimals is ~0.2px at a
// 1920-wide export — far finer than anyone can see — and it keeps the Step 4
// number boxes readable after a freehand drag.
const POSITION_DECIMALS = 4;

export function roundPosition(value: number): number {
  const factor = 10 ** POSITION_DECIMALS;
  return Math.round(value * factor) / factor;
}

export interface Position {
  x: number;
  y: number;
}

// Where an overlay lands after the pointer has moved (dx, dy) PIXELS from the
// point where it was grabbed.
//
// Two design notes worth understanding:
//
// It works in DELTAS, not absolute pointer positions. `start` is the overlay's
// position when the drag began, and we add the total movement since. That is
// what makes grabbing an overlay by its corner feel right — it follows the
// cursor instead of teleporting its centre under it. It also means we never need
// to know where the frame sits in the window, only how big it is.
//
// It does NOT clamp. Keeping a value inside 0–1 is an invariant of the data, so
// it belongs in the reducer where every caller gets it — the drag, the inspector
// number fields, and M9's project loader alike.
export function draggedPosition(
  start: Position,
  delta: { dx: number; dy: number },
  frame: FrameSize,
): Position {
  // A zero-sized frame is real: it happens for the render before the video's
  // metadata loads. Dividing by it yields Infinity, then NaN once it is added
  // to anything — and React will write NaN straight into the style attribute.
  if (frame.width <= 0 || frame.height <= 0) return start;

  return {
    x: start.x + delta.dx / frame.width,
    y: start.y + delta.dy / frame.height,
  };
}
