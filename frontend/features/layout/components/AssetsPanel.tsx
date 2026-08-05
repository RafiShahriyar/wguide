// frontend/features/layout/components/AssetsPanel.tsx

import { Panel } from "@/components/layout/Panel";

// Temporary placeholder data — real assets arrive in Milestone 3.
// `string[]` (not `as const`) so `.length` is a number and the `=== 0`
// empty-state check is valid TypeScript.
const PLACEHOLDER_ASSETS: string[] = [
  "rotation-run.mp4",
  "keycap-e.png",
  "keycap-lmb.png",
  "arrow-right.png",
];

export function AssetsPanel() {
  return (
    <Panel title="Assets">
      {PLACEHOLDER_ASSETS.length === 0 ? (
        <p className="text-xs text-zinc-500">No assets yet.</p>
      ) : (
        <ul className="space-y-1">
          {PLACEHOLDER_ASSETS.map((name) => (
            <li
              key={name}
              className="cursor-pointer truncate rounded px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
