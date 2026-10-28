"use client";

import { useEffect, useState } from "react";
import { Rnd } from "react-rnd";
import { X } from "lucide-react";
import { APP_BY_ID, type AppId } from "../lib/apps";
import { useDesktop } from "../lib/windows";

// Window control glyphs: hand-drawn so every angle is exactly 90 degrees
const glyphProps = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "butt",
  strokeLinejoin: "miter",
  "aria-hidden": true,
  className: "size-3.5",
} as const;

const MinimizeGlyph = () => (
  <svg {...glyphProps}>
    <path d="M3 5.5 8 10.5 13 5.5" />
  </svg>
);

const MaximizeGlyph = () => (
  <svg {...glyphProps}>
    <path d="M3 10.5 8 5.5 13 10.5" />
  </svg>
);

const RestoreGlyph = () => (
  <svg {...glyphProps}>
    <path d="M8 2.5 13.5 8 8 13.5 2.5 8Z" />
  </svg>
);

export default function AppWindow({ id }: { id: AppId }) {
  const app = APP_BY_ID[id];
  const win = useDesktop((s) => s.windows[id]);
  const focused = useDesktop((s) => s.focused === id);
  const focus = useDesktop((s) => s.focus);
  const close = useDesktop((s) => s.close);
  const minimize = useDesktop((s) => s.minimize);
  const toggleMaximize = useDesktop((s) => s.toggleMaximize);
  const setGeometry = useDesktop((s) => s.setGeometry);

  // Briefly enables size and position transitions so maximize and restore animate
  const [snapping, setSnapping] = useState(false);
  useEffect(() => {
    if (!snapping) return;
    const timer = setTimeout(() => setSnapping(false), 220);
    return () => clearTimeout(timer);
  }, [snapping]);

  if (!win.open) return null;

  const Icon = app.icon;
  const Content = app.Content;

  const handleMaximize = () => {
    setSnapping(true);
    toggleMaximize(id);
  };

  const className = [
    "win",
    focused && "win-focused",
    win.minimized && "win-minimized",
    win.maximized && "win-maximized",
    snapping && "win-snap",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Rnd
      className={className}
      style={{ zIndex: win.z }}
      bounds="parent"
      dragHandleClassName="win-titlebar"
      cancel=".win-controls"
      minWidth={320}
      minHeight={220}
      disableDragging={win.maximized}
      enableResizing={!win.maximized}
      position={win.maximized ? { x: 0, y: 0 } : { x: win.x, y: win.y }}
      size={
        win.maximized
          ? { width: "100%", height: "100%" }
          : { width: win.w, height: win.h }
      }
      onDragStop={(_, data) => setGeometry(id, { x: data.x, y: data.y })}
      onResizeStop={(_, __, ref, ___, position) =>
        setGeometry(id, {
          w: ref.offsetWidth,
          h: ref.offsetHeight,
          x: position.x,
          y: position.y,
        })
      }
    >
      <div
        role="dialog"
        aria-label={app.title}
        className="win-frame flex h-full flex-col"
        onPointerDownCapture={() => focus(id)}
        style={{ backdropFilter: "blur(50px)" }}
      >
        <header className="win-titlebar" onDoubleClick={handleMaximize}>
          <Icon className="size-5 shrink-0" />
          <span className="truncate text-sm font-medium tracking-wide">
            {app.title}
          </span>
          <div
            className="win-controls ml-auto flex items-center gap-0.5"
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="win-btn"
              aria-label={`Minimize ${app.title}`}
              onClick={() => minimize(id)}
            >
              <MinimizeGlyph />
            </button>
            <button
              type="button"
              className="win-btn"
              aria-label={`${win.maximized ? "Restore" : "Maximize"} ${app.title}`}
              onClick={handleMaximize}
            >
              {win.maximized ? <RestoreGlyph /> : <MaximizeGlyph />}
            </button>
            <button
              type="button"
              className="win-btn win-btn-close"
              aria-label={`Close ${app.title}`}
              onClick={() => close(id)}
            >
              <X size={15} />
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">
          <Content />
        </main>
      </div>
    </Rnd>
  );
}
