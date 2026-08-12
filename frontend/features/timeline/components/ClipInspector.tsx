// frontend/features/timeline/components/ClipInspector.tsx

"use client";

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { formatTime } from "@/features/player/formatTime";
import { seekTo } from "@/features/player/playerSlice";
import { selectPlayer } from "@/features/player/playerSelectors";
import { deleteClip, updateClip } from "@/features/timeline/timelineSlice";
import { Field, INPUT } from "./Field";
import { TransformFields } from "./TransformFields";
import type { KeyboardClip, OverlayClip } from "@/features/timeline/types";

// The editing form for the selected clip. Every input is CONTROLLED by the
// store: what you see is `clip.x`, and typing dispatches `updateClip`, which
// re-renders this form from the new store value. There is no second copy of
// the truth — except for one deliberate case, see `keysDraft` below.
//
// `Field` and `INPUT` used to live here. Step 4 moved them to their own file
// once TransformFields needed them too.

export function ClipInspector({ clip }: { clip: OverlayClip }) {
  const dispatch = useAppDispatch();
  // The video's length lives in the PLAYER slice, but the timeline reducer needs
  // it to stop a clip being retimed past the end of the footage. So this form
  // reads it and passes it in the payload — the same arrangement the viewport
  // actions use for `bounds`. The reducer stays pure and the dependency is
  // visible in the action's type instead of hidden inside it.
  const { duration: videoDuration } = useAppSelector(selectPlayer);

  // Number inputs report strings. Number("") is 0, so an empty box would jump
  // the value to 0 as you clear it — we ignore blank input instead and let the
  // reducer clamp whatever does parse.
  function patchNumber(
    field: "start" | "duration" | "fadeIn" | "fadeOut",
    raw: string,
  ) {
    if (raw.trim() === "") return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    dispatch(
      updateClip({ id: clip.id, patch: { [field]: value }, videoDuration }),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
          {clip.kind}
        </span>
        <button
          type="button"
          onClick={() => dispatch(deleteClip(clip.id))}
          className="rounded border border-red-900 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-950"
        >
          Delete
        </button>
      </div>

      <Field label="Name">
        <input
          className={INPUT}
          value={clip.name}
          onChange={(event) =>
            dispatch(
              updateClip({ id: clip.id, patch: { name: event.target.value } }),
            )
          }
        />
      </Field>

      <div className="flex gap-2">
        <Field label="Start (s)">
          <input
            className={INPUT}
            type="number"
            step={0.1}
            min={0}
            value={clip.start}
            onChange={(event) => patchNumber("start", event.target.value)}
          />
        </Field>
        <Field label="Length (s)">
          <input
            className={INPUT}
            type="number"
            step={0.1}
            min={0.5}
            value={clip.duration}
            onChange={(event) => patchNumber("duration", event.target.value)}
          />
        </Field>
      </div>

      {/* Fades are timing, so they belong here with Start and Length rather than
          in the Transform section. */}
      <div className="flex gap-2">
        <Field label="Fade in (s)">
          <input
            className={INPUT}
            type="number"
            step={0.1}
            min={0}
            value={clip.fadeIn}
            onChange={(event) => patchNumber("fadeIn", event.target.value)}
          />
        </Field>
        <Field label="Fade out (s)">
          <input
            className={INPUT}
            type="number"
            step={0.1}
            min={0}
            value={clip.fadeOut}
            onChange={(event) => patchNumber("fadeOut", event.target.value)}
          />
        </Field>
      </div>

      {clip.kind === "keyboard" ? (
        <KeysField clip={clip} />
      ) : (
        <>
          <Field label="Text">
            <input
              className={INPUT}
              value={clip.props.text}
              onChange={(event) =>
                dispatch(
                  updateClip({
                    id: clip.id,
                    patch: {
                      props: { ...clip.props, text: event.target.value },
                    },
                  }),
                )
              }
            />
          </Field>
          <Field label="Colour">
            <input
              className="h-7 w-full rounded border border-zinc-700 bg-zinc-900"
              type="color"
              value={clip.props.color}
              onChange={(event) =>
                dispatch(
                  updateClip({
                    id: clip.id,
                    patch: {
                      props: { ...clip.props, color: event.target.value },
                    },
                  }),
                )
              }
            />
          </Field>
        </>
      )}

      <TransformFields clip={clip} />

      <button
        type="button"
        onClick={() => dispatch(seekTo(clip.start))}
        className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800"
      >
        Jump to {formatTime(clip.start)} – {formatTime(clip.start + clip.duration)}
      </button>
    </div>
  );
}

// The one field that needs a local draft.
//
// The DATA is `string[]`; the INPUT is one comma-separated line. If the input
// read straight from the store, typing "Q, " would round-trip through
// ["Q"] → "Q" and the browser would swallow your comma and space mid-keystroke.
// So the raw text is UI state and the parsed array is data — the rule being:
// keep the user's literal keystrokes until they parse into something real.
function KeysField({ clip }: { clip: KeyboardClip }) {
  const dispatch = useAppDispatch();
  const [draft, setDraft] = useState(clip.props.keys.join(", "));

  // Re-seed the draft only when a DIFFERENT clip is selected. Depending on the
  // keys themselves would overwrite what you are typing on every keystroke.
  useEffect(() => {
    setDraft(clip.props.keys.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id]);

  function onChange(raw: string) {
    setDraft(raw);
    const keys = raw
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key.length > 0);
    dispatch(updateClip({ id: clip.id, patch: { props: { keys } } }));
  }

  return (
    <Field label="Keys (comma separated)">
      <input
        className={INPUT}
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Q, E, Shift"
      />
    </Field>
  );
}
