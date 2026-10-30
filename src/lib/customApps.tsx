"use client";

import { useMemo } from "react";
import type { ComponentType } from "react";
import { create } from "zustand";

// -------- Types --------
export type AppEntry = {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  Content: ComponentType;
};

export type CustomApp = {
  id: string;
  title: string;
  source: string;
  compiled: string;
  hasIcon: boolean;
  installed: number;
  updated: number;
};

type InstallInput = Pick<CustomApp, "title" | "source" | "compiled" | "hasIcon">;
type SaveResult = { ok: true } | { ok: false; error: string };

// -------- Constants --------
const KEY_PREFIX = "zytros:app:";

// The window id used for the app currently being test run from IDEX
export const TEST_ID = "test-run";

export const REACT_URL =
  "https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.development.js";
export const REACT_DOM_URL =
  "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.development.js";

// -------- Storage --------
const appId = (title: string) =>
  "custom-" +
  (title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "app");

function readAll(): CustomApp[] {
  const found: CustomApp[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      try {
        const app = JSON.parse(localStorage.getItem(key) ?? "null");
        if (app && typeof app.id === "string" && typeof app.compiled === "string") {
          found.push(app);
        }
      } catch {
        // skip this entry
      }
    }
  } catch {
    // storage unavailable, no custom apps
  }
  return found.sort((a, b) => a.installed - b.installed);
}

// -------- Store --------
type CustomStore = {
  apps: CustomApp[];
  // The app being test run from IDEX, never saved to storage
  test: CustomApp | null;
  hydrate: () => void;
  install: (input: InstallInput) => SaveResult;
  uninstall: (id: string) => void;
  // Returns the run id, which the test window echoes back in its messages
  runTest: (input: InstallInput) => number;
  clearTest: () => void;
};

export const useCustomApps = create<CustomStore>()((set, get) => ({
  apps: [],
  test: null,

  // Called once on the client so the server render matches the first client render
  hydrate: () => set({ apps: readAll() }),

  install: (input) => {
    const id = appId(input.title);
    const existing = get().apps.find((a) => a.id === id);
    const now = Date.now();
    const app: CustomApp = {
      ...input,
      id,
      installed: existing?.installed ?? now,
      updated: now,
    };
    try {
      localStorage.setItem(KEY_PREFIX + id, JSON.stringify(app));
    } catch {
      return {
        ok: false,
        error: "Could not install. Browser storage is full or unavailable.",
      };
    }
    set((s) => ({
      apps: [...s.apps.filter((a) => a.id !== id), app].sort(
        (a, b) => a.installed - b.installed,
      ),
    }));
    return { ok: true };
  },

  uninstall: (id) => {
    try {
      localStorage.removeItem(KEY_PREFIX + id);
    } catch {
      // nothing to clean up
    }
    set((s) => ({ apps: s.apps.filter((a) => a.id !== id) }));
  },

  runTest: (input) => {
    const run = Math.max(Date.now(), (get().test?.updated ?? 0) + 1);
    set({
      test: { ...input, id: TEST_ID, installed: run, updated: run },
    });
    return run;
  },

  clearTest: () => set((s) => (s.test === null ? s : { test: null })),
}));

// -------- Runtime documents --------

// Precompiled code runs in a sandboxed iframe, so only React is loaded at runtime.
// Passing a run id turns on test mode: console output, errors and a final status
// (including the icon size check) are posted back to IDEX
export function buildInstalledDoc(
  compiled: string,
  mode: "app" | "icon",
  run?: number,
) {
  const source = JSON.stringify(compiled).replace(/</g, "\\u003c");
  // color-scheme is pinned so the iframe canvas stays transparent
  const css =
    mode === "icon"
      ? "html{color-scheme:light}html,body,#root{width:100%;height:100%;margin:0;overflow:hidden;background:transparent}"
      : "html{color-scheme:light}html,body{margin:0;height:100%;font-family:system-ui,sans-serif;background:transparent}#root{height:100%}";
  const target = mode === "icon" ? "mod.exports.Icon" : "mod.exports.default";
  const runId = run === undefined ? "null" : String(run);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>${css}</style>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<script src="${REACT_URL}"></script>
<script src="${REACT_DOM_URL}"></script>
</head>
<body>
<div id="root"></div>
<script>
(function () {
  var RUN = ${runId};
  var failed = false;
  var post = function (data) {
    if (RUN === null) return;
    data.idex = true;
    data.run = RUN;
    parent.postMessage(data, "*");
  };
  var fmt = function (a) {
    if (typeof a === "string") return a;
    if (a instanceof Error) return a.stack || String(a);
    try {
      var s = JSON.stringify(a, null, 2);
      return s === undefined ? String(a) : s;
    } catch (e) {
      return String(a);
    }
  };
  var send = function (type, args) {
    post({ type: type, text: Array.prototype.map.call(args, fmt).join(" ") });
  };
  if (RUN !== null) {
    console.log = function () { send("out", arguments); };
    console.info = function () { send("out", arguments); };
    console.debug = function () { send("out", arguments); };
    console.warn = function () { send("err", arguments); };
    console.error = function () { send("err", arguments); };
    window.addEventListener("error", function (e) { failed = true; send("err", [e.message]); });
    window.addEventListener("unhandledrejection", function (e) { failed = true; send("err", [e.reason]); });
  }
  try {
    var mod = { exports: {} };
    var req = function (name) {
      if (name === "react") return React;
      if (name === "react-dom" || name === "react-dom/client") return ReactDOM;
      throw new Error("Cannot import " + name + ". Only react and react-dom are available.");
    };
    new Function("React", "ReactDOM", "module", "exports", "require", ${source})(React, ReactDOM, mod, mod.exports, req);
    var C = ${target};
    if (!C && RUN !== null) {
      post({ type: "status", ok: false, error: "No default export or App component found." });
      return;
    }
    if (C) ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(C));

    if (RUN !== null) {
      // the icon is measured inside a 64x64 box, it must scale to fit
      var Icon = mod.exports.Icon;
      var box = null;
      if (Icon) {
        box = document.createElement("div");
        box.style.cssText = "position:fixed;left:-9999px;top:0;width:64px;height:64px;";
        document.body.appendChild(box);
        ReactDOM.createRoot(box).render(React.createElement(Icon));
      }
      // give render errors a moment to surface before reporting success
      setTimeout(function () {
        var error = null;
        if (failed) {
          error = "The app threw an error, see the output above.";
        } else if (box) {
          var child = box.firstElementChild;
          var r = child ? child.getBoundingClientRect() : null;
          if (!r || (r.width === 0 && r.height === 0)) {
            error = "Icon rendered nothing visible.";
          } else if (r.width > 64.5 || r.height > 64.5) {
            error = "Icon must scale to its container. It rendered " + Math.round(r.width) + "x" + Math.round(r.height) + " in a 64x64 box. Use width and height of 100% or an SVG viewBox.";
          }
        }
        post({
          type: "status",
          ok: !error,
          error: error,
          hasIcon: !!Icon,
          title: typeof mod.exports.title === "string" ? mod.exports.title : null
        });
      }, 500);
    }
  } catch (e) {
    var msg = e && e.message ? e.message : String(e);
    document.body.textContent = msg;
    post({ type: "status", ok: false, error: msg });
  }
})();
</script>
</body>
</html>`;
}

// -------- Components --------
function DefaultAppIcon() {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#6366f1" />
      <path
        d="M26 22 16 32l10 10M38 22l10 10-10 10"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CustomIcon({ app, className }: { app: CustomApp; className?: string }) {
  const doc = useMemo(
    () => (app.hasIcon ? buildInstalledDoc(app.compiled, "icon") : null),
    [app],
  );
  return (
    <div
      className={className}
      style={{
        aspectRatio: "1 / 1",
        overflow: "hidden",
        borderRadius: "22%",
        pointerEvents: "none",
      }}
    >
      {doc ? (
        <iframe
          title=""
          tabIndex={-1}
          aria-hidden="true"
          sandbox="allow-scripts"
          srcDoc={doc}
          style={{
            width: "100%",
            height: "100%",
            border: 0,
            display: "block",
            background: "transparent",
            colorScheme: "light",
          }}
        />
      ) : (
        <DefaultAppIcon />
      )}
    </div>
  );
}

function CustomAppView({ app }: { app: CustomApp }) {
  const doc = useMemo(
    () =>
      buildInstalledDoc(
        app.compiled,
        "app",
        app.id === TEST_ID ? app.updated : undefined,
      ),
    [app],
  );
  return (
    <iframe
      title={app.title}
      sandbox="allow-scripts"
      srcDoc={doc}
      className="h-full w-full border-0"
      style={{ background: "transparent", colorScheme: "light" }}
    />
  );
}

// Entries are cached so component identities stay stable between renders
const entryCache = new Map<string, { updated: number; entry: AppEntry }>();

export function toEntry(app: CustomApp): AppEntry {
  const hit = entryCache.get(app.id);
  if (hit && hit.updated === app.updated) return hit.entry;
  const entry: AppEntry = {
    id: app.id,
    title: app.title,
    icon: (props) => <CustomIcon app={app} className={props.className} />,
    Content: () => <CustomAppView app={app} />,
  };
  entryCache.set(app.id, { updated: app.updated, entry });
  return entry;
}
