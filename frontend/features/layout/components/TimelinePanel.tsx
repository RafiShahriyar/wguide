// frontend/features/layout/components/TimelinePanel.tsx

// Ruler tick data — the real timeline (Milestone 4) derives ticks from zoom.
const RULER_SECONDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function TimelinePanel() {
  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="flex h-6 shrink-0 items-end overflow-hidden border-b border-zinc-800 bg-zinc-900 px-3 font-mono text-[10px] text-zinc-600">
        {RULER_SECONDS.map((seconds) => (
          <span key={seconds} className="w-16 shrink-0">
            {seconds}s
          </span>
        ))}
      </div>
      <div className="flex flex-1 items-center justify-center p-3">
        <p className="text-xs text-zinc-600">
          Timeline — tracks and the playhead arrive in Milestone 4
        </p>
      </div>
    </div>
  );
}
