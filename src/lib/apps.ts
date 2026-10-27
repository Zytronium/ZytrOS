import type { ComponentType } from "react";
import WelcomeIcon from "../components/app_icons/WelcomeIcon";
import Welcome from "../components/apps/Welcome";
import AboutIcon from "../components/app_icons/AboutIcon";
import About from "../components/apps/About";
import NotepadIcon from "../components/app_icons/NotepadIcon";
import Notepad from "../components/apps/Notepad";
import IDEXIcon from "@/components/app_icons/IDEXIcon";
import IDEX from "@/components/apps/IDEX";

// The order here is the order on the desktop, the taskbar, and the start menu
export const APPS = [
  { id: "welcome", title: "Welcome to ZytrOS!", icon: WelcomeIcon, Content: Welcome },
  { id: "about", title: "About ZytrOS", icon: AboutIcon, Content: About },
  { id: "notepad", title: "Notepad", icon: NotepadIcon, Content: Notepad },
  { id: "idex", title: "IDEX", icon: IDEXIcon, Content: IDEX },
] as const;

export type AppDef = (typeof APPS)[number];
export type AppId = AppDef["id"];

export const APP_BY_ID = Object.fromEntries(
  APPS.map((app) => [app.id, app]),
) as Record<AppId, AppDef & { Content: ComponentType }>;
