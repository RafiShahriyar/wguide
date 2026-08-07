// frontend/features/layout/components/PreviewPanel.tsx

"use client";

import { Panel } from "@/components/layout/Panel";
import { VideoPicker } from "@/features/player/components/VideoPicker";
import { VideoPlayer } from "@/features/player/components/VideoPlayer";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { requestPick } from "@/features/player/playerSlice";
import { selectPlayer } from "@/features/player/playerSelectors";

export function PreviewPanel() {
  const dispatch = useAppDispatch();
  const { status, sourceUrl } = useAppSelector(selectPlayer);

  return (
    <Panel title="Preview">
      <VideoPicker />
      {status === "ready" && sourceUrl ? (
        <VideoPlayer sourceUrl={sourceUrl} />
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="rounded-md border border-dashed border-zinc-700 p-6 text-center">
            <p className="text-xs text-zinc-500">No video loaded</p>
            <button
              type="button"
              onClick={() => dispatch(requestPick())}
              className="mt-3 rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
            >
              Open a video…
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
