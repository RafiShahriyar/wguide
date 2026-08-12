// frontend/features/timeline/components/TransformFields.tsx

"use client";

import { useAppDispatch } from "@/hooks/useRedux";
import { updateClip } from "@/features/timeline/timelineSlice";
import { DEFAULT_TRANSFORM } from "@/features/timeline/newClip";
import { Field, INPUT } from "./Field";
import type { ClipTransform, OverlayClip } from "@/features/timeline/types";

// The geometry half of the Properties form: the five numbers on every clip's
// `transform`, each as a slider paired with a number box, plus a Reset.
//
// Split out of ClipInspector rather than bolted on. ClipInspector was already
// ~180 lines and these five rows would have pushed it past the ~300-line
// guideline — and "the fields that edit timing and content" and "the fields that
// edit geometry" are genuinely two jobs.

// A slider and a number box editing ONE value.
//
// Both controls are bound to the same `value` and call the same `onChange`, so
// there is no question of which one is authoritative: neither is. The store is.
// Drag the slider and the box follows; type in the box and the slider follows.
function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  // Number inputs hand back strings, and `Number("")` is 0 — so a cleared box
  // would jump the value to zero as you emptied it. Same guard as the Start and
  // Length fields.
  //
  // It quietly solves a second problem too. Type "0." and the browser reports an
  // empty value, because "0." is not yet a valid number. We do not dispatch, so
  // nothing re-renders, so the DOM keeps your literal "0." on screen until you
  // type the digit that makes it real. The lesson from KeysField — keep the
  // user's keystrokes until they parse — without needing a draft, because here
  // the store and the input hold the same SHAPE of value.
  function commit(raw: string) {
    if (raw.trim() === "") return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onChange(parsed);
  }

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="range"
          className="min-w-0 flex-1 accent-emerald-500"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          type="number"
          className={`${INPUT} w-16 shrink-0`}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => commit(event.target.value)}
        />
      </div>
    </Field>
  );
}

export function TransformFields({ clip }: { clip: OverlayClip }) {
  const dispatch = useAppDispatch();
  const transform = clip.transform;

  // One dispatch path for all five controls. `ClipPatch.transform` carries a
  // WHOLE ClipTransform — the convention `props` set in M5 — so a single-field
  // edit is expressed by spreading the current one and overriding a field.
  // Taking `Partial<ClipTransform>` keeps that spread in one place and lets
  // TypeScript check the field name and its type at every call below.
  function set(changes: Partial<ClipTransform>) {
    dispatch(
      updateClip({
        id: clip.id,
        patch: { transform: { ...transform, ...changes } },
      }),
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-800 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
          Transform
        </span>
        <button
          type="button"
          // A COPY of the defaults, for the reason makeNewClip spreads them too:
          // handing the constant itself into the store would let Redux Toolkit
          // freeze it, and every later Reset would be resetting a frozen object.
          onClick={() => set({ ...DEFAULT_TRANSFORM })}
          className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
        >
          Reset
        </button>
      </div>

      {/* x and y are fractions of the frame, so 0–1 with 1% steps. They are shown
          in the data's own units rather than as percentages: one set of units
          everywhere is what keeps the editor and M8's export agreeing. */}
      <SliderField
        label="X (0–1)"
        value={transform.x}
        min={0}
        max={1}
        step={0.01}
        onChange={(x) => set({ x })}
      />
      <SliderField
        label="Y (0–1)"
        value={transform.y}
        min={0}
        max={1}
        step={0.01}
        onChange={(y) => set({ y })}
      />
      <SliderField
        label="Scale"
        value={transform.scale}
        min={0.2}
        max={4}
        step={0.05}
        onChange={(scale) => set({ scale })}
      />
      <SliderField
        label="Rotation (°)"
        value={transform.rotation}
        min={-180}
        max={180}
        step={1}
        onChange={(rotation) => set({ rotation })}
      />
      <SliderField
        label="Opacity"
        value={transform.opacity}
        min={0}
        max={1}
        step={0.01}
        onChange={(opacity) => set({ opacity })}
      />
    </div>
  );
}
