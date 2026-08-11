// frontend/features/layout/components/PropertiesPanel.tsx

"use client";

import { Panel } from "@/components/layout/Panel";
import { useAppSelector } from "@/hooks/useRedux";
import { selectSelectedClip } from "@/features/timeline/timelineSelectors";
import { ClipInspector } from "@/features/timeline/components/ClipInspector";

export function PropertiesPanel() {
  // The panel itself only decides "is anything selected?" — the form lives
  // with the timeline feature that owns the data it edits.
  const clip = useAppSelector(selectSelectedClip);

  return (
    <Panel title="Properties">
      {clip ? (
        <ClipInspector clip={clip} />
      ) : (
        <p className="text-xs text-zinc-500">
          Select an overlay to edit its properties.
        </p>
      )}
    </Panel>
  );
}
