"use client";

import { useApps } from "../lib/apps";
import { TASKBAR_RESERVE, useDesktop } from "../lib/windows";

export default function DesktopIcons() {
  const launch = useDesktop((s) => s.launch);
  const apps = useApps();

  return (
    <nav
      aria-label="Desktop"
      className="absolute left-3 top-3 z-[1] flex flex-col flex-wrap content-start gap-1"
      style={{ bottom: TASKBAR_RESERVE }}
    >
      {apps.map(({ id, title, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => launch(id)}
          className="group flex w-24 flex-col items-center gap-1.5 rounded-xl px-1 py-2 outline-offset-0 transition-colors hover:bg-accent/[0.07]"
        >
          <Icon className="size-14 shadow-[0_6px_18px_-6px_rgb(0_0_0/0.7)] transition group-hover:brightness-125" />
          <span className="icon-label text-center text-[13px] leading-tight text-fg">
            {title}
          </span>
        </button>
      ))}
    </nav>
  );
}
