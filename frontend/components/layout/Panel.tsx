// frontend/components/layout/Panel.tsx

import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  // `children` is React's built-in slot: whatever you put between
  // <Panel>…</Panel> tags is passed here and rendered in the body.
  children: ReactNode;
}

export function Panel({ title, children }: PanelProps) {
  return (
    <section className="flex min-h-0 flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Title bar — always the same, driven by the `title` prop */}
      <header className="flex h-8 shrink-0 items-center border-b border-zinc-800 bg-zinc-900 px-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {title}
        </h2>
      </header>

      {/* Body — whatever the parent decided to put inside */}
      <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </section>
  );
}
