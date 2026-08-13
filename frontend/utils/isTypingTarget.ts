// frontend/utils/isTypingTarget.ts

// "Is the user typing into something right now?"
//
// Every global keyboard handler needs this, because a window-level listener sees
// keys that were meant for a text box. Without it, typing "Q, E" into the Keys
// field would also fire the shortcuts bound to those letters, and pressing Delete
// to fix a typo in the Name box would delete the clip.
//
// Extracted on its second use: `usePlayerShortcuts` had it inline, and
// `useTimelineShortcuts` needs exactly the same rule. Two copies of a security
// guard is how they drift apart.
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}
