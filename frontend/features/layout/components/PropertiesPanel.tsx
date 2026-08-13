// frontend/features/layout/components/PropertiesPanel.tsx

"use client";

import { Panel } from "@/components/layout/Panel";
import { useAppSelector } from "@/hooks/useRedux";
import {
  selectSelectedClipIds,
  selectSoleSelectedClip,
} from "@/features/timeline/timelineSelectors";
import { ClipInspector } from "@/features/timeline/components/ClipInspector";
import { MultiClipInspector } from "@/features/timeline/components/MultiClipInspector";

export function PropertiesPanel() {
  // The panel only decides WHICH of three states to show — none, one, several.
  // The forms live with the timeline feature that owns the data they edit.
  //
  // `selectSoleSelectedClip` already returns null unless exactly one clip is
  // selected, so the ordering below cannot accidentally show the single-clip form
  // for a group: the selector settled that question.
  const ids = useAppSelector(selectSelectedClipIds);
  const clip = useAppSelector(selectSoleSelectedClip);

  return (
    <Panel title="Properties">
      {clip ? (
        <ClipInspector clip={clip} />
      ) : ids.length > 1 ? (
        <MultiClipInspector ids={ids} />
      ) : (
        <p className="text-xs text-zinc-500">
          Select an overlay to edit its properties.
        </p>
      )}
    </Panel>
  );
}
