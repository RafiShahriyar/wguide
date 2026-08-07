// frontend/components/layout/EditorShell.tsx

"use client";

import { MenuBar } from "./MenuBar";
import { StatusBar } from "./StatusBar";
import { PanelDivider } from "./PanelDivider";
import { AssetsPanel } from "@/features/layout/components/AssetsPanel";
import { PreviewPanel } from "@/features/layout/components/PreviewPanel";
import { PropertiesPanel } from "@/features/layout/components/PropertiesPanel";
import { TimelinePanel } from "@/features/layout/components/TimelinePanel";
import { useAppSelector } from "@/hooks/useRedux";
import { selectPanels } from "@/features/layout/layoutSelectors";
import { usePlayerShortcuts } from "@/features/player/hooks/usePlayerShortcuts";

export function EditorShell() {
  const panels = useAppSelector(selectPanels);
  usePlayerShortcuts();

  return (
    // CSS Grid lays out the four big rows. grid-template-areas lets us
    // "name" each row so it reads like a picture of the screen.
    <div
      className="grid h-screen bg-zinc-950 text-zinc-100"
      style={{
        gridTemplateAreas: '"menubar" "main" "timeline" "statusbar"',
        // Timeline height is driven by the layout slice (panels.timeline),
        // so dragging the horizontal divider above it resizes this row.
        gridTemplateRows: `36px minmax(0, 1fr) ${panels.timeline}px 28px`,
        gridTemplateColumns: "minmax(0, 1fr)",
      }}
    >
      <div style={{ gridArea: "menubar" }}>
        <MenuBar />
      </div>

      {/* main row: assets | divider | preview | divider | properties */}
      <div style={{ gridArea: "main" }} className="flex min-h-0">
        <div style={{ width: panels.assets }} className="shrink-0">
          <AssetsPanel />
        </div>
        <PanelDivider panel="assets" />
        <div className="min-w-0 flex-1">
          <PreviewPanel />
        </div>
        <PanelDivider panel="properties" />
        <div style={{ width: panels.properties }} className="shrink-0">
          <PropertiesPanel />
        </div>
      </div>

      {/* timeline row: horizontal divider on top, panel below it */}
      <div
        style={{ gridArea: "timeline" }}
        className="flex min-h-0 flex-col"
      >
        <PanelDivider panel="timeline" orientation="horizontal" />
        <div className="min-h-0 flex-1">
          <TimelinePanel />
        </div>
      </div>

      <div style={{ gridArea: "statusbar" }}>
        <StatusBar />
      </div>
    </div>
  );
}
