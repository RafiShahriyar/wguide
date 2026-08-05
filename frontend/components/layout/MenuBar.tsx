// frontend/components/layout/MenuBar.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import { useAppDispatch } from "@/hooks/useRedux";
import { resetLayout } from "@/features/layout/layoutSlice";

// All the possible things a menu item can DO. Only actions listed here are
// wired to real code — every other item renders disabled.
type MenuAction = "resetLayout";

interface MenuItem {
  label: string;
  shortcut?: string;
  // No `action` => placeholder (disabled until the milestone that needs it).
  action?: MenuAction;
}

interface Menu {
  name: string;
  items: MenuItem[];
}

// Data-driven again: the whole menu is described by this array, not by JSX.
// `as const` on items is skipped because the items are objects (already typed).
const MENUS: Menu[] = [
  {
    name: "File",
    items: [
      { label: "Open Video…", shortcut: "Ctrl+O" },
      { label: "Export MP4…", shortcut: "Ctrl+E" },
    ],
  },
  {
    name: "Edit",
    items: [
      { label: "Undo", shortcut: "Ctrl+Z" },
      { label: "Redo", shortcut: "Ctrl+Y" },
    ],
  },
  {
    name: "View",
    items: [{ label: "Reset Layout", action: "resetLayout" }],
  },
  {
    name: "Help",
    items: [{ label: "About GuideForge" }],
  },
];

export function MenuBar() {
  const dispatch = useAppDispatch();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // A ref to the whole bar, so we can ask "did this click happen inside us?"
  const barRef = useRef<HTMLElement>(null);

  // While a menu is open, close it when the user clicks anywhere OUTSIDE
  // the menu bar. `contains` is the classic "inside or outside?" check.
  useEffect(() => {
    if (openMenu === null) return;
    function onDocMouseDown(event: MouseEvent) {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [openMenu]);

  function toggleMenu(name: string) {
    setOpenMenu(openMenu === name ? null : name);
  }

  function onItemClick(item: MenuItem) {
    setOpenMenu(null);
    if (item.action === "resetLayout") {
      dispatch(resetLayout());
    }
  }

  return (
    <header
      ref={barRef}
      className="flex h-9 items-center gap-1 border-b border-zinc-800 bg-zinc-900 px-3"
    >
      {/* Brand */}
      <div className="mr-2 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 font-mono text-xs font-bold text-emerald-400">
          G
        </div>
        <span className="text-xs font-semibold text-zinc-200">GuideForge</span>
      </div>

      {/* Menus rendered from data */}
      <nav className="flex items-center gap-1">
        {MENUS.map((menu) => (
          <div key={menu.name} className="relative">
            <button
              type="button"
              onClick={() => toggleMenu(menu.name)}
              className={`rounded px-2 py-1 text-xs transition-colors hover:bg-zinc-800 hover:text-zinc-100 ${
                openMenu === menu.name
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-300"
              }`}
            >
              {menu.name}
            </button>

            {openMenu === menu.name && (
              <div
                role="menu"
                className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-zinc-700 bg-zinc-900 p-1 shadow-xl"
              >
                {menu.items.map((item) => {
                  const isDisabled = !item.action;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      disabled={isDisabled}
                      onClick={() => onItemClick(item)}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs ${
                        isDisabled
                          ? "cursor-not-allowed text-zinc-600"
                          : "text-zinc-200 hover:bg-emerald-600/20 hover:text-emerald-200"
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="ml-4 font-mono text-[10px] text-zinc-600">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>
    </header>
  );
}
