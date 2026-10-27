import type { ComponentType } from "react";
import WelcomeIcon from "../components/app_icons/WelcomeIcon";
import Welcome from "../components/apps/Welcome";
import AboutIcon from "../components/app_icons/AboutIcon";
import About from "../components/apps/About";

// The order here is the order on the desktop, the taskbar, and the start menu
export const APPS = [
  { id: "welcome", title: "Welcome to ZytrOS!", icon: WelcomeIcon, Content: Welcome },
  { id: "about", title: "About ZytrOS", icon: AboutIcon, Content: About },
] as const;

export type AppDef = (typeof APPS)[number];
export type AppId = AppDef["id"];

export const APP_BY_ID = Object.fromEntries(
  APPS.map((app) => [app.id, app]),
) as Record<AppId, AppDef & { Content: ComponentType }>;
