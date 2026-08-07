// frontend/features/player/components/TransportBar.tsx

"use client";

import { useState } from "react";
import { useAppSelector } from "@/hooks/useRedux";
import { selectPlayer } from "@/features/player/playerSelectors";
import { formatTime } from "@/features/player/formatTime";

interface TransportBarProps {
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
}

export function TransportBar({ onTogglePlay, onSeek }: TransportBarProps) {
  const { isPlaying, currentTime, duration } = useAppSelector(selectPlayer);

  // While the user drags the seek thumb we want to see where they're pointing,
  // even though the element's `timeupdate` echoes the "real" time. `draft`
  // overrides the display during a drag; it's cleared on release.
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? currentTime;

  return (
    <div className="flex items-center gap-3 border-t border-zinc-800 bg-zinc-900 px-3 py-2">
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-zinc-950 transition-colors hover:bg-emerald-500"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <span className="w-10 text-right font-mono text-xs text-zinc-400">
        {formatTime(shown)}
      </span>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.01}
        value={shown}
        disabled={duration === 0}
        onPointerDown={() => setDraft(shown)}
        onChange={(event) => {
          const next = Number(event.target.value);
          setDraft(next);
          onSeek(next);
        }}
        onPointerUp={() => setDraft(null)}
        onPointerCancel={() => setDraft(null)}
        className="h-1.5 flex-1 cursor-pointer accent-emerald-500"
      />

      <span className="w-10 font-mono text-xs text-zinc-500">
        {formatTime(duration)}
      </span>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
      <path d="M6 4.5v11l9-5.5-9-5.5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
      <rect x="4.5" y="4.5" width="4" height="11" rx="1" />
      <rect x="11.5" y="4.5" width="4" height="11" rx="1" />
    </svg>
  );
}