// frontend/features/timeline/components/Field.tsx

// One labelled row of the Properties form, plus the input styling every row
// shares.
//
// Both of these started life as private helpers inside ClipInspector. Step 4
// gave them a second consumer (TransformFields), which is this project's cue to
// extract: a pattern earns its own file on its SECOND use, not its first. Doing
// it earlier is guessing; doing it later means two copies drifting apart.

import type { ReactNode } from "react";

export const INPUT =
  "w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-emerald-600";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
