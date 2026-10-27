"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 250);
  return () => clearInterval(timer);
}

// Snapshots are whole seconds, so React only re-renders when the second changes
const getSnapshot = (): number | null => Math.floor(Date.now() / 1000);
const getServerSnapshot = (): number | null => null;

export default function Clock() {
  const seconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const now = seconds === null ? null : new Date(seconds * 1000);

  return (
    <div
      className="flex min-w-[5.25rem] flex-col items-end px-2 leading-tight"
      aria-live="off"
    >
      <time
        dateTime={now?.toISOString()}
        className="font-mono text-[13px] font-medium tabular-nums text-fg"
      >
        {now
          ? now.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })
          : "\u00a0"}
      </time>
      <span className="text-[11px] text-dim">
        {now
          ? now.toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
          : "\u00a0"}
      </span>
    </div>
  );
}
