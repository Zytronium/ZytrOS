import { create } from "zustand";
import { getApps, type AppId } from "./apps";
import { TEST_ID, useCustomApps, type CustomApp } from "./customApps";

// Space kept free at the bottom of the screen for the floating taskbar
export const TASKBAR_RESERVE = 88;

// Below this width, windows open maximized
const MOBILE_BREAKPOINT = 768;

export type WindowState = {
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  placed: boolean;
  z: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Geometry = Pick<WindowState, "x" | "y" | "w" | "h">;

type DesktopStore = {
  windows: Record<AppId, WindowState>;
  focused: AppId | null;
  topZ: number;
  // Open, restore, and focus (desktop icons and start menu)
  launch: (id: AppId) => void;
  // Open, restore, focus, or minimize depending on current state (taskbar)
  taskbarClick: (id: AppId) => void;
  focus: (id: AppId) => void;
  blur: () => void;
  close: (id: AppId) => void;
  minimize: (id: AppId) => void;
  toggleMaximize: (id: AppId) => void;
  setGeometry: (id: AppId, geometry: Partial<Geometry>) => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const blankWindow = (): WindowState => ({
  open: false,
  minimized: false,
  maximized: false,
  placed: false,
  z: 0,
  x: 0,
  y: 0,
  w: 760,
  h: 500,
});

// Custom first-open sizes for apps that don't need the default window size
const INITIAL_SIZE: Partial<Record<AppId, { w: number; h: number }>> = {
  welcome: { w: 520, h: 360 },
};

// Picks a first-open position near the center, fanned out a little per app
function place(id: AppId): Geometry & { maximized: boolean } {
  const apps = getApps();
  const vw = window.innerWidth;
  const vh = window.innerHeight - TASKBAR_RESERVE;
  const size = INITIAL_SIZE[id] ?? { w: 780, h: 520 };
  const w = Math.min(size.w, vw - 24);
  const h = Math.min(size.h, vh - 24);
  // The welcome window stays dead center, the others fan out
  const offset =
    id === "welcome"
      ? 0
      : apps.findIndex((app) => app.id === id) - (apps.length - 1) / 2;
  return {
    w,
    h,
    x: clamp(Math.round((vw - w) / 2 + offset * 32), 0, Math.max(0, vw - w)),
    y: clamp(Math.round((vh - h) / 2 + offset * 26), 0, Math.max(0, vh - h)),
    maximized: vw < MOBILE_BREAKPOINT,
  };
}

// The visible window with the highest z, used to hand focus on after minimize or close
function topVisible(
  windows: Record<AppId, WindowState>,
  exclude: AppId,
): AppId | null {
  let best: AppId | null = null;
  for (const id of Object.keys(windows)) {
    const win = windows[id];
    if (id === exclude || !win.open || win.minimized) continue;
    if (best === null || win.z > windows[best].z) best = id;
  }
  return best;
}

export const useDesktop = create<DesktopStore>()((set, get) => ({
  windows: Object.fromEntries(
    getApps().map((app) => [app.id, blankWindow()]),
  ) as Record<AppId, WindowState>,
  focused: null,
  topZ: 0,

  launch: (id) =>
    set((s) => {
      const win = s.windows[id] ?? blankWindow();
      const z = s.topZ + 1;
      const placement = win.placed ? {} : place(id);
      return {
        topZ: z,
        focused: id,
        windows: {
          ...s.windows,
          [id]: { ...win, ...placement, open: true, minimized: false, placed: true, z },
        },
      };
    }),

  taskbarClick: (id) => {
    const s = get();
    const win = s.windows[id];
    if (!win || !win.open || win.minimized) s.launch(id);
    else if (s.focused === id) s.minimize(id);
    else s.focus(id);
  },

  focus: (id) =>
    set((s) => {
      if (!s.windows[id]) return s;
      if (s.focused === id && s.windows[id].z === s.topZ) return s;
      const z = s.topZ + 1;
      return {
        topZ: z,
        focused: id,
        windows: { ...s.windows, [id]: { ...s.windows[id], z } },
      };
    }),

  blur: () => set((s) => (s.focused === null ? s : { focused: null })),

  close: (id) => {
    set((s) => {
      if (!s.windows[id]) return s;
      const windows = {
        ...s.windows,
        [id]: { ...s.windows[id], open: false, minimized: false },
      };
      return {
        windows,
        focused: s.focused === id ? topVisible(windows, id) : s.focused,
      };
    });
    // Closing the test window discards the test app
    if (id === TEST_ID) useCustomApps.getState().clearTest();
  },

  minimize: (id) =>
    set((s) => {
      if (!s.windows[id]) return s;
      const windows = {
        ...s.windows,
        [id]: { ...s.windows[id], minimized: true },
      };
      return {
        windows,
        focused: s.focused === id ? topVisible(windows, id) : s.focused,
      };
    }),

  toggleMaximize: (id) =>
    set((s) => {
      if (!s.windows[id]) return s;
      return {
        windows: {
          ...s.windows,
          [id]: { ...s.windows[id], maximized: !s.windows[id].maximized },
        },
      };
    }),

  setGeometry: (id, geometry) =>
    set((s) => {
      if (!s.windows[id]) return s;
      return { windows: { ...s.windows, [id]: { ...s.windows[id], ...geometry } } };
    }),
}));

// -------- Custom app window sync --------

// Keeps a window entry for every installed app (and the test app) and drops entries
// of removed ones, so components can keep reading windows[id] without checking
function syncCustomWindows(apps: CustomApp[], test: CustomApp | null) {
  useDesktop.setState((s) => {
    const ids = new Set(apps.map((a) => a.id));
    if (test) ids.add(TEST_ID);
    const windows = { ...s.windows };
    let changed = false;
    for (const id of ids) {
      if (!windows[id]) {
        windows[id] = blankWindow();
        changed = true;
      }
    }
    for (const id of Object.keys(windows)) {
      if ((id.startsWith("custom-") || id === TEST_ID) && !ids.has(id)) {
        delete windows[id];
        changed = true;
      }
    }
    if (!changed) return s;
    const focused =
      s.focused && !windows[s.focused] ? topVisible(windows, s.focused) : s.focused;
    return { windows, focused };
  });
}

useCustomApps.subscribe((state, prev) => {
  syncCustomWindows(state.apps, state.test);
  // Every test run opens (or reloads and refocuses) the test window
  if (state.test && state.test !== prev.test) {
    useDesktop.getState().launch(TEST_ID);
  }
});
