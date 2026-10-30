"use client";

import { useEffect, useRef, useState } from "react";
import { House } from "lucide-react";
import { useApps, useWindowApps } from "../lib/apps";
import { TEST_ID } from "../lib/customApps";
import { useDesktop } from "../lib/windows";
import Clock from "./Clock";

export default function Taskbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const windows = useDesktop((s) => s.windows);
  const focused = useDesktop((s) => s.focused);
  const launch = useDesktop((s) => s.launch);
  const taskbarClick = useDesktop((s) => s.taskbarClick);

  // The start menu lists real apps, the taskbar also shows the test app while it is open
  const apps = useApps();
  const windowApps = useWindowApps();

  // Close the start menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div
      ref={rootRef}
      className="fixed bottom-4 left-1/2 z-[1000] max-w-[calc(100vw-0.75rem)] -translate-x-1/2"
    >
      {menuOpen && (
        <div
          role="menu"
          aria-label="Start menu"
          className="glass menu-pop absolute bottom-[calc(100%+0.75rem)] left-0 w-60 rounded-2xl p-2"
        >
          {apps.map(({ id, title, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              onClick={() => {
                launch(id);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-accent/10 hover:text-accent"
            >
              <Icon className="size-7" />
              {title}
            </button>
          ))}
        </div>
      )}

      <div
        role="toolbar"
        aria-label="Taskbar"
        className="glass flex h-14 items-center gap-1 rounded-2xl px-2 sm:gap-1.5"
      >
        <button
          type="button"
          aria-label="Start menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className={`grid size-10 shrink-0 place-items-center rounded-xl transition-colors sm:size-11 ${
            menuOpen ? "bg-accent/20" : "hover:bg-accent/10"
          }`}
        >
          <House size={22} strokeWidth={1.7} className="text-accent" />
        </button>

        <span className="mx-0.5 h-6 w-px bg-line" aria-hidden />

        {windowApps.map(({ id, title, icon: Icon }) => {
          const win = windows[id];
          if (!win) return null;
          // The test app only shows up while its window is open
          if (id === TEST_ID && !win.open) return null;
          const active = focused === id && win.open && !win.minimized;
          return (
            <button
              key={id}
              type="button"
              aria-label={title}
              aria-pressed={active}
              onClick={() => taskbarClick(id)}
              className={`group relative grid size-10 shrink-0 place-items-center rounded-xl transition-colors sm:size-11 ${
                active ? "bg-accent/15" : "hover:bg-accent/10"
              }`}
            >
              <Icon className="size-7 sm:size-8" />
              {win.open && (
                <span
                  aria-hidden
                  className={`absolute bottom-0.5 h-0.5 rounded-full bg-accent transition-all ${
                    active ? "w-4 shadow-[0_0_8px_var(--color-accent)]" : "w-1.5 opacity-60"
                  }`}
                />
              )}
              <span className="glass pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-fg opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {title}
              </span>
            </button>
          );
        })}

        <span className="mx-0.5 h-6 w-px bg-line" aria-hidden />

        <Clock />
      </div>
    </div>
  );
}
