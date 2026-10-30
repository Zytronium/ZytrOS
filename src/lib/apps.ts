import { useMemo } from "react";
import WelcomeIcon from "../components/app_icons/WelcomeIcon";
import Welcome from "../components/apps/Welcome";
import AboutIcon from "../components/app_icons/AboutIcon";
import About from "../components/apps/About";
import NotepadIcon from "../components/app_icons/NotepadIcon";
import Notepad from "../components/apps/Notepad";
import IDEXIcon from "@/components/app_icons/IDEXIcon";
import IDEX from "@/components/apps/IDEX";
import { toEntry, useCustomApps, type AppEntry } from "./customApps";

// The order here is the order on the desktop, the taskbar, and the start menu
export const APPS = [
  { id: "welcome", title: "Welcome to ZytrOS!", icon: WelcomeIcon, Content: Welcome },
  { id: "about", title: "About ZytrOS", icon: AboutIcon, Content: About },
  { id: "notepad", title: "Notepad", icon: NotepadIcon, Content: Notepad },
  { id: "idex", title: "IDEX", icon: IDEXIcon, Content: IDEX },
] as unknown as AppEntry[];

export type AppDef = AppEntry;
export type AppId = string;

// Every app that can have a window: built-in, installed, and the app being test run
export function getApps(): AppEntry[] {
  const { apps, test } = useCustomApps.getState();
  return [...APPS, ...apps.map(toEntry), ...(test ? [toEntry(test)] : [])];
}

export function getApp(id: string): AppEntry | undefined {
  return getApps().find((app) => app.id === id);
}

// Built-in apps first, then installed custom apps in install order.
// Used for icons and menus, so the temporary test app is left out
export function useApps(): AppEntry[] {
  const custom = useCustomApps((s) => s.apps);
  return useMemo(() => [...APPS, ...custom.map(toEntry)], [custom]);
}

// Same list plus the test app, used wherever a window needs to exist
export function useWindowApps(): AppEntry[] {
  const custom = useCustomApps((s) => s.apps);
  const test = useCustomApps((s) => s.test);
  return useMemo(
    () => [...APPS, ...custom.map(toEntry), ...(test ? [toEntry(test)] : [])],
    [custom, test],
  );
}

export function useApp(id: string): AppEntry | undefined {
  const apps = useWindowApps();
  return apps.find((app) => app.id === id);
}
