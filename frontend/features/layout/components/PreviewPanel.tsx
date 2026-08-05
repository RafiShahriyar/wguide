// frontend/features/layout/components/PreviewPanel.tsx

import { Panel } from "@/components/layout/Panel";

export function PreviewPanel() {
  return (
    <Panel title="Preview">
      <div className="flex h-full items-center justify-center">
        <div className="rounded-md border border-dashed border-zinc-700 p-6 text-center">
          <p className="text-xs text-zinc-500">No video loaded</p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Open a video in Milestone 3
          </p>
        </div>
      </div>
    </Panel>
  );
}
