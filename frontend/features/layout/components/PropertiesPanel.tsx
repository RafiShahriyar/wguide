// frontend/features/layout/components/PropertiesPanel.tsx

import { Panel } from "@/components/layout/Panel";

export function PropertiesPanel() {
  return (
    <Panel title="Properties">
      <p className="text-xs text-zinc-500">
        Select an overlay to edit its properties.
      </p>
    </Panel>
  );
}
