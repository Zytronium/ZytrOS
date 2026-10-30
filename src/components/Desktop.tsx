"use client";

import { useEffect, type CSSProperties } from "react";
import { useWindowApps } from "../lib/apps";
import { useCustomApps } from "../lib/customApps";
import { TASKBAR_RESERVE, useDesktop } from "../lib/windows";
import AppWindow from "./AppWindow";
import DesktopIcons from "./DesktopIcons";
import Taskbar from "./Taskbar";
import Wallpaper from "./Wallpaper";

export default function Desktop() {
  const blur = useDesktop((s) => s.blur);
  const launch = useDesktop((s) => s.launch);
  const hydrate = useCustomApps((s) => s.hydrate);
  const apps = useWindowApps();

  // Load installed custom apps from local storage
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Open the welcome window when the desktop loads
  useEffect(() => {
    launch("welcome");
  }, [launch]);

  return (
    <div className="relative h-dvh w-screen select-none overflow-hidden">
      <Wallpaper onPointerDown={blur} />

      <DesktopIcons />

      <div
        className="pointer-events-none absolute inset-0 isolate z-10"
        style={{ "--taskbar-reserve": `${TASKBAR_RESERVE}px` } as CSSProperties}
      >
        {apps.map(({ id }) => (
          <AppWindow key={id} id={id} />
        ))}
      </div>

      <Taskbar />
    </div>
  );
}
