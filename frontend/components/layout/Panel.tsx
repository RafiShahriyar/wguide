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
    // `h-full` is load-bearing, not decoration. Each panel sits inside a plain
    // block-level <div>, and a block container does NOT stretch its children
    // vertically — so without this the section is only as tall as its content.
    // That matters because `min-h-0` and `flex-1` below, and `h-full`/`max-h-full`
    // further down in VideoPlayer, are all PERCENTAGES: they need a parent with a
    // definite height to resolve against, or they quietly fall back to `auto`.
    // With `auto` all the way down, the video's height ends up driven by the
    // panel's WIDTH (via `max-w-full` and the aspect ratio) and it happily
    // overflows the row it lives in.
    <section className="flex h-full min-h-0 flex-col border-r border-zinc-800 bg-zinc-950">
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
