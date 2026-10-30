"use client";
// this comment enables font-digital class
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import sql from "highlight.js/lib/languages/sql";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import java from "highlight.js/lib/languages/java";
import kotlin from "highlight.js/lib/languages/kotlin";
import swift from "highlight.js/lib/languages/swift";
import rust from "highlight.js/lib/languages/rust";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import go from "highlight.js/lib/languages/go";
import dart from "highlight.js/lib/languages/dart";
import perl from "highlight.js/lib/languages/perl";
import type { Language } from "highlight.js";
import { REACT_URL, REACT_DOM_URL, useCustomApps } from "@/lib/customApps";

// -------- Types --------
type Lang =
  | "javascript"
  | "typescript"
  | "jsx"
  | "tsx"
  | "app"
  | "python"
  | "ruby"
  | "sql"
  | "html"
  | "css"
  | "xml"
  | "java"
  | "kotlin"
  | "swift"
  | "rust"
  | "c"
  | "cpp"
  | "csharp"
  | "go"
  | "dart"
  | "perl"
  | "chicken"
  | "plaintext";

// worker: runs in a Web Worker, preview: runs in a sandboxed iframe, xml: well-formedness check,
// app: compiled in the worker, then opened as a test window on the desktop
type RunKind = "worker" | "preview" | "xml" | "app";

type Line = { kind: "out" | "err" | "sys"; text: string };

type StoredMeta = {
  name: string;
  base: string;
  lang: Lang;
  gen: string;
  chunks: number;
  size: number;
  updated: number;
};

type MenuItem = {
  label: string;
  onClick?: () => void;
  hint?: string;
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  header?: boolean;
};

type SaveResult = { ok: true } | { ok: false; error: string };

// -------- Constants --------

// Order here is the order shown in the language menu and dropdown
const LANGS: Record<
  Lang,
  { label: string; ext: string; indent: string; hl: string | null; run: RunKind | null }
> = {
  javascript: { label: "JavaScript", ext: ".js", indent: "  ", hl: "javascript", run: "worker" },
  typescript: { label: "TypeScript", ext: ".ts", indent: "  ", hl: "typescript", run: "worker" },
  jsx: { label: "JSX", ext: ".jsx", indent: "  ", hl: "javascript", run: "preview" },
  tsx: { label: "TSX", ext: ".tsx", indent: "  ", hl: "typescript", run: "preview" },
  app: { label: "App", ext: ".app.tsx", indent: "  ", hl: "typescript", run: "app" },
  python: { label: "Python", ext: ".py", indent: "    ", hl: "python", run: "worker" },
  ruby: { label: "Ruby", ext: ".rb", indent: "  ", hl: "ruby", run: "worker" },
  sql: { label: "SQL", ext: ".sql", indent: "  ", hl: "sql", run: "worker" },
  html: { label: "HTML", ext: ".html", indent: "  ", hl: "xml", run: "preview" },
  css: { label: "CSS", ext: ".css", indent: "  ", hl: "css", run: null },
  xml: { label: "XML", ext: ".xml", indent: "  ", hl: "xml", run: "xml" },
  java: { label: "Java", ext: ".java", indent: "    ", hl: "java", run: null },
  kotlin: { label: "Kotlin", ext: ".kt", indent: "    ", hl: "kotlin", run: null },
  swift: { label: "Swift", ext: ".swift", indent: "    ", hl: "swift", run: null },
  rust: { label: "Rust", ext: ".rs", indent: "    ", hl: "rust", run: null },
  c: { label: "C", ext: ".c", indent: "    ", hl: "c", run: null },
  cpp: { label: "C++", ext: ".cpp", indent: "    ", hl: "cpp", run: null },
  csharp: { label: "C#", ext: ".cs", indent: "    ", hl: "csharp", run: null },
  go: { label: "Go", ext: ".go", indent: "\t", hl: "go", run: null },
  dart: { label: "Dart", ext: ".dart", indent: "  ", hl: "dart", run: null },
  perl: { label: "Perl", ext: ".pl", indent: "    ", hl: "perl", run: null },
  chicken: { label: "Chicken", ext: ".chicken", indent: "", hl: "chicken", run: "worker" },
  plaintext: { label: "PlainText", ext: ".txt", indent: "    ", hl: null, run: null },
};

const LANG_LIST = Object.keys(LANGS) as Lang[];

// own-property check so inherited keys like "constructor" are not treated as languages
function isLang(value: unknown): value is Lang {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(LANGS, value)
  );
}

// Runtimes are downloaded from these CDNs the first time a language is run
const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const SQLJS_URL = "https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/";
const BABEL_URL = "https://cdn.jsdelivr.net/npm/@babel/standalone@7.26.0/babel.min.js";
const OPAL_URL = "https://cdn.opalrb.com/opal/current/";

const MAX_OUTPUT_LINES = 2000;
const STORAGE_PREFIX = "idex";

// Each stored chunk stays well under any per-item limit a browser might have
const CHUNK_SIZE = 200_000;

// -------- Syntax highlighting --------
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("java", java);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("go", go);
hljs.registerLanguage("dart", dart);
hljs.registerLanguage("perl", perl);

// Chicken has no built-in highlight.js grammar, so we define a minimal one
const chickenLang = (): Language => ({
  name: "Chicken",
  contains: [{ className: "keyword", begin: /\bchicken\b/ }],
});

hljs.registerLanguage("chicken", chickenLang);

// Highlighting on every keystroke would lag on huge files, so skip it past this size
const MAX_HIGHLIGHT_CHARS = 200_000;

// Both layers must share identical metrics or the colors drift out of alignment
const EDITOR_TEXT =
  "p-2 pt-2.5 font-mono text-sm leading-5 whitespace-pre [tab-size:4]";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlight(text: string, lang: Lang) {
  const hl = LANGS[lang].hl;
  if (!hl || text.length > MAX_HIGHLIGHT_CHARS) return escapeHtml(text);
  try {
    return hljs.highlight(text, { language: hl, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(text);
  }
}

// -------- Runner (Web Worker source) --------

// Runs user code off the main thread so a bad loop never freezes the page
// and so the Stop button can terminate it
const WORKER_SOURCE = `
let pyodide = null;
let SQL = null;
const NL = String.fromCharCode(10);
const post = (type, text) => self.postMessage({ type: type, text: text });
const fmt = (v) => {
  if (typeof v === "string") return v;
  if (v instanceof Error) return v.stack || String(v);
  try {
    const s = JSON.stringify(v, null, 2);
    return s === undefined ? String(v) : s;
  } catch (e) {
    return String(v);
  }
};
const makeConsole = () => {
  const out = (...a) => post("out", a.map(fmt).join(" "));
  const err = (...a) => post("err", a.map(fmt).join(" "));
  const base = { log: out, info: out, debug: out, dir: out, table: out, warn: err, error: err };
  // any other console method (group, time, trace...) is a harmless no-op instead of a TypeError
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : () => {}) });
};
const runScript = async (source) => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction("console", source)(makeConsole());
};
const table = (cols, rows) => {
  const shown = rows.slice(0, 1000);
  const cell = (v) => (v === null ? "NULL" : String(v));
  const body = shown.map((r) => r.map(cell));
  const widths = cols.map((c, i) => Math.max(c.length, ...body.map((r) => r[i].length)));
  const pad = (s, w) => s + " ".repeat(w - s.length);
  const line = (r) => r.map((s, i) => pad(s, widths[i])).join(" | ");
  const out = [line(cols), widths.map((w) => "-".repeat(w)).join("-+-")].concat(body.map(line));
  if (rows.length > shown.length) out.push("... " + (rows.length - shown.length) + " more rows not shown");
  return out.join(NL);
};
self.onmessage = async (e) => {
  const lang = e.data.lang;
  const code = e.data.code;
  try {
    if (lang === "python") {
      if (!pyodide) {
        post("sys", "Loading Python runtime...");
        importScripts("${PYODIDE_URL}pyodide.js");
        pyodide = await self.loadPyodide({ indexURL: "${PYODIDE_URL}" });
        pyodide.setStdout({ batched: (s) => post("out", s) });
        pyodide.setStderr({ batched: (s) => post("err", s) });
      }
      await pyodide.runPythonAsync(code);
    } else if (lang === "sql") {
      if (!SQL) {
        post("sys", "Loading SQLite...");
        importScripts("${SQLJS_URL}sql-wasm.js");
        SQL = await self.initSqlJs({ locateFile: (f) => "${SQLJS_URL}" + f });
      }
      const db = new SQL.Database();
      try {
        const results = db.exec(code);
        if (!results.length) post("sys", "Done. No rows returned.");
        results.forEach((r) => post("out", table(r.columns, r.values)));
      } finally {
        db.close();
      }
    } else if (lang === "ruby") {
      if (!self.Opal) {
        post("sys", "Loading Ruby (Opal)...");
        importScripts("${OPAL_URL}opal.min.js", "${OPAL_URL}opal-parser.min.js");
      }
      const original = self.console;
      self.console = makeConsole();
      try {
        if (typeof self.Opal.eval === "function") self.Opal.eval(code);
        else (0, self.eval)(self.Opal.compile(code));
      } finally {
        self.console = original;
      }
    } else if (lang === "typescript") {
      if (!self.Babel) {
        post("sys", "Loading TypeScript compiler...");
        importScripts("${BABEL_URL}");
      }
      const js = self.Babel.transform(code, { filename: "main.ts", presets: ["typescript"] }).code;
      await runScript(js);
    } else if (lang === "app") {
      if (!self.Babel) {
        post("sys", "Loading TypeScript compiler...");
        importScripts("${BABEL_URL}");
      }
      post("sys", "Compiling app...");
      let out = self.Babel.transform(code, {
        filename: "app.tsx",
        presets: [["react"], ["typescript", { isTSX: true, allExtensions: true }]],
        plugins: ["transform-modules-commonjs"]
      }).code;
      out += NL + ";if (typeof App !== 'undefined' && !module.exports.default) module.exports.default = App;";
      post("compiled", out);
    } else if (lang === "chicken") {
      // each line is one instruction, its opcode is the number of chickens
      const ops = code.split(NL).map((line, i) => {
        const t = line.trim();
        if (!t) return 0;
        const words = t.split(" ").filter((w) => w.length);
        if (words.some((w) => w !== "chicken")) {
          throw new Error("Line " + (i + 1) + ": only the word chicken is allowed");
        }
        return words.length;
      });
      // stack[0] is the stack itself and stack[1] is the (empty) input
      const input = [];
      const stack = [null, input];
      stack[0] = stack;
      let ip = 0;
      let halted = false;
      const pop = () => {
        if (stack.length <= 2) throw new Error("Stack underflow at line " + (ip + 1));
        return stack.pop();
      };
      const load = (src, addr) => {
        const source = stack[src];
        if (!source || typeof source !== "object") {
          throw new Error("Invalid source at line " + (ip + 1));
        }
        return source[addr];
      };
      while (ip < ops.length && !halted) {
        const op = ops[ip];
        if (op === 0) {
          halted = true;
          break;
        }
        if (op === 1) {
          stack.push("chicken");
        } else if (op === 2) {
          const a = pop();
          const b = pop();
          stack.push(a + b);
        } else if (op === 3) {
          const a = pop();
          const b = pop();
          stack.push(b - a);
        } else if (op === 4) {
          const a = pop();
          const b = pop();
          stack.push(a * b);
        } else if (op === 5) {
          const a = pop();
          const b = pop();
          stack.push(a === b ? 1 : 0);
        } else if (op === 6) {
          const addr = pop();
          const src = pop();
          stack.push(load(src, addr));
        } else if (op === 7) {
          const addr = pop();
          const src = pop();
          stack.push(stack[load(src, addr)]);
        } else if (op === 8) {
          const offset = Number(pop());
          const cond = pop();
          if (cond) ip += offset;
        } else if (op === 9) {
          stack.push(String.fromCharCode(Number(pop())));
        } else {
          stack.push(op - 10);
        }
        ip++;
      } 
      if (stack.length > 2) post("out", String(stack[stack.length - 1]));
    } else {
      await runScript(code);
    }
  } catch (err) {
    post("err", err && err.message ? err.message : String(err));
  }
  post("done");
};
`;

// -------- Runner (iframe preview source) --------

// Forwards console output and errors from the sandboxed preview to the output panel
const PREVIEW_HOOK = `<script>
(function () {
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
    parent.postMessage({ idex: true, type: type, text: Array.prototype.map.call(args, fmt).join(" ") }, "*");
  };
  console.log = function () { send("out", arguments); };
  console.info = function () { send("out", arguments); };
  console.debug = function () { send("out", arguments); };
  console.warn = function () { send("err", arguments); };
  console.error = function () { send("err", arguments); };
  window.addEventListener("error", function (e) { send("err", [e.message]); });
  window.addEventListener("unhandledrejection", function (e) { send("err", [e.reason]); });
})();
</script>`;

// matches <head> and <head ...> but not <header>
const HEAD_TAG = /<head(\s[^>]*)?>/i;
const DOCTYPE_TAG = /<!doctype[^>]*>/i;

function buildHtmlPreview(code: string) {
  if (HEAD_TAG.test(code)) {
    return code.replace(HEAD_TAG, (m) => m + PREVIEW_HOOK);
  }
  // keep the doctype first so the page does not fall into quirks mode
  if (DOCTYPE_TAG.test(code)) {
    return code.replace(DOCTYPE_TAG, (m) => m + PREVIEW_HOOK);
  }
  return PREVIEW_HOOK + code;
}

// Compiles JSX or TSX in the iframe with Babel, then renders the default export or App
function buildReactPreview(code: string, tsx: boolean) {
  const source = JSON.stringify(code).replace(/</g, "\\u003c");
  const presets = tsx
    ? '[["react"], ["typescript", { isTSX: true, allExtensions: true }]]'
    : '[["react"]]';
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
${PREVIEW_HOOK}
<script src="${REACT_URL}"></script>
<script src="${REACT_DOM_URL}"></script>
<script src="${BABEL_URL}"></script>
</head>
<body style="margin:0;font-family:system-ui,sans-serif">
<div id="root"></div>
<script>
(function () {
  var SOURCE = ${source};
  try {
    var out = Babel.transform(SOURCE, {
      filename: "app.${tsx ? "tsx" : "jsx"}",
      presets: ${presets},
      plugins: ["transform-modules-commonjs"]
    }).code;
    out += String.fromCharCode(10) + ";if (typeof App !== 'undefined' && !module.exports.default) module.exports.default = App;";
    var mod = { exports: {} };
    var req = function (name) {
      if (name === "react") return React;
      if (name === "react-dom" || name === "react-dom/client") return ReactDOM;
      throw new Error("Cannot import " + name + ". Only react and react-dom are available.");
    };
    new Function("React", "ReactDOM", "module", "exports", "require", out)(React, ReactDOM, mod, mod.exports, req);
    var C = mod.exports.default;
    if (C) ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(C));
    else console.info("No default export or App component found to render.");
  } catch (e) {
    console.error(e && e.message ? e.message : String(e));
  }
})();
</script>
</body>
</html>`;
}

// -------- Custom app helpers --------
const EXAMPLE_APP = `import { useState } from "react";

// optional, defaults to the file name
export const title = "Counter";

// optional, must scale to fill its container
export function Icon() {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%">
      <rect width="64" height="64" rx="14" fill="#6366f1" />
      <text x="32" y="43" fontSize="30" textAnchor="middle" fill="white">+1</text>
    </svg>
  );
}

// the window background is translucent by default
export default function App() {
  const [n, setN] = useState(0);
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        height: "100%",
        color: "#e5e7eb",
      }}
    >
      <button
        onClick={() => setN(n + 1)}
        style={{
          padding: "10px 18px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(255,255,255,0.08)",
          color: "inherit",
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        Clicked {n} times
      </button>
    </div>
  );
}
`;

const APP_GUIDE = [
  "How to build custom apps",
  "1. Pick App in the language menu.",
  "2. Export a default component (or name it App). It fills the app window.",
  "3. Optional: export const title = \"My App\" to set the name.",
  "4. Optional: export function Icon() for the desktop icon. It must scale to fill its container.",
  "   Use width and height of 100% or an SVG viewBox. It can be animated too.",
  "5. Without an Icon export, a default icon is used.",
  "6. The window background is transparent. Set your own colors if you want a solid background.",
  "7. Only react and react-dom can be imported.",
  "8. Press Run. Your app opens in its own test window on the desktop.",
  "9. If it runs without errors, Install unlocks. Editing the code locks it until you run again.",
  "10. Closing the test window discards the test, an installed app is not affected.",
  "Use Help > Insert example app for a starting point.",
];

// -------- Local storage helpers --------
const metaKey = (name: string) =>
  `${STORAGE_PREFIX}:meta:${encodeURIComponent(name)}`;

const chunkKey = (name: string, gen: string, i: number) =>
  `${STORAGE_PREFIX}:data:${encodeURIComponent(name)}:${gen}:${i}`;

function isQuotaError(e: unknown) {
  return (
    e instanceof DOMException &&
    (e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 ||
      e.code === 1014)
  );
}

function readMeta(name: string): StoredMeta | null {
  try {
    const raw = localStorage.getItem(metaKey(name));
    return raw ? (JSON.parse(raw) as StoredMeta) : null;
  } catch {
    return null;
  }
}

function listFiles(): StoredMeta[] {
  const found: StoredMeta[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(`${STORAGE_PREFIX}:meta:`)) continue;
      // one corrupt entry must not hide every other saved file
      try {
        const meta = JSON.parse(localStorage.getItem(key) ?? "null");
        if (meta && typeof meta.name === "string") found.push(meta);
      } catch {
        // skip this entry
      }
    }
  } catch {
    // storage unavailable, show an empty list
  }
  return found.sort((a, b) => b.updated - a.updated);
}

function removeChunks(meta: StoredMeta) {
  for (let i = 0; i < meta.chunks; i++) {
    localStorage.removeItem(chunkKey(meta.name, meta.gen, i));
  }
}

function splitIntoChunks(text: string): string[] {
  const parts: string[] = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(pos + CHUNK_SIZE, text.length);
    // do not cut a surrogate pair in half
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
    parts.push(text.slice(pos, end));
    pos = end;
  }
  return parts.length ? parts : [""];
}

function saveFile(
  name: string,
  base: string,
  lang: Lang,
  text: string,
): SaveResult {
  const previous = readMeta(name);
  const gen = Date.now().toString(36);
  const parts = splitIntoChunks(text);
  const written: string[] = [];

  try {
    // write the new chunks first so the old copy survives a failed save
    parts.forEach((part, i) => {
      const key = chunkKey(name, gen, i);
      localStorage.setItem(key, part);
      written.push(key);
    });
    const meta: StoredMeta = {
      name,
      base,
      lang,
      gen,
      chunks: parts.length,
      size: text.length,
      updated: Date.now(),
    };
    localStorage.setItem(metaKey(name), JSON.stringify(meta));
  } catch (e) {
    written.forEach((key) => localStorage.removeItem(key));
    if (isQuotaError(e)) {
      return {
        ok: false,
        error: `File too large to save (${formatSize(text.length)}). Browser storage is full or the limit is reached, usually about 5 MB for all saved files combined. Use Download to keep a copy.`,
      };
    }
    return {
      ok: false,
      error: "Could not save. Browser storage is unavailable. Use Download to keep a copy.",
    };
  }

  if (previous) removeChunks(previous);
  return { ok: true };
}

function loadFile(meta: StoredMeta): string | null {
  try {
    let text = "";
    for (let i = 0; i < meta.chunks; i++) {
      const part = localStorage.getItem(chunkKey(meta.name, meta.gen, i));
      if (part === null) return null;
      text += part;
    }
    return text;
  } catch {
    return null;
  }
}

function deleteStored(meta: StoredMeta) {
  localStorage.removeItem(metaKey(meta.name));
  removeChunks(meta);
}

// -------- Small helpers --------
function formatSize(chars: number) {
  return chars < 1024 ? `${chars} B` : `${(chars / 1024).toFixed(1)} KB`;
}

function safeBase(base: string) {
  return base.trim().replace(/[\\/:*?"<>|]/g, "_") || "untitled";
}

// -------- Auto-indent --------
const CLOSERS: Record<string, string> = { "{": "}", "[": "]", "(": ")" };

// Returns the text to insert for Enter and how far the caret should sit from the start of it
function autoIndent(
  value: string,
  start: number,
  end: number,
  lang: Lang,
): { text: string; caret: number } {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const line = before.slice(before.lastIndexOf("\n") + 1);

  // keep the indentation of the current line
  const current = line.match(/^[ \t]*/)![0];
  const unit = LANGS[lang].indent;
  const last = line.trimEnd().slice(-1);

  const opensBlock =
    last in CLOSERS || (lang === "python" && last === ":");

  if (!opensBlock) {
    const text = "\n" + current;
    return { text, caret: text.length };
  }

  // Enter between a bracket pair puts the closer on its own line
  if (last in CLOSERS && after[0] === CLOSERS[last] && line.trimEnd() === line) {
    const mid = "\n" + current + unit;
    return { text: mid + "\n" + current, caret: mid.length };
  }

  const text = "\n" + current + unit;
  return { text, caret: text.length };
}

// -------- Auto-unindent --------
const CLOSE_CHARS = new Set(["}", "]", ")"]);

// How many characters to strip from the end of a whitespace run to remove one indent level
function unitLength(ws: string, unit: string) {
  if (ws.endsWith(unit)) return unit.length;
  if (ws.endsWith("\t")) return 1;
  const trailing = ws.length - ws.trimEnd().length;
  // a whitespace-only string trims to empty, so count trailing spaces directly
  const spaces = ws.match(/ +$/)?.[0].length ?? trailing;
  return Math.min(spaces, unit.length);
}

export default function IDEX() {
  const [code, setCode] = useState("");
  const [lang, setLang] = useState<Lang>("javascript");
  const [base, setBase] = useState("untitled");
  const [savedCode, setSavedCode] = useState("");
  const [files, setFiles] = useState<StoredMeta[]>([]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [output, setOutput] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);
  const [showOutput, setShowOutput] = useState(true);
  const [preview, setPreview] = useState<{ html: string; key: number } | null>(
    null,
  );
  const [notice, setNotice] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  // Result of the last app test run, tied to the exact code that was run
  const [check, setCheck] = useState<{
    code: string;
    ok: boolean;
    compiled: string;
    hasIcon: boolean;
    title: string | null;
  } | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerUrlRef = useRef<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gutterRef = useRef<HTMLPreElement>(null);

  // App test run bookkeeping, read by the worker and message handlers
  const runCodeRef = useRef("");
  const compiledRef = useRef("");
  const testBaseRef = useRef("app");
  const runIdRef = useRef<number | null>(null);

  const customApps = useCustomApps((s) => s.apps);

  const filename = `${safeBase(base)}${LANGS[lang].ext}`;
  const dirty = code !== savedCode;
  const installable =
    lang === "app" && check !== null && check.ok && check.code === code;
  const runKind = LANGS[lang].run;
  const canRun = runKind !== null;
  const highlighted = useMemo(() => highlight(code, lang), [code, lang]);
  const lineNumbers = useMemo(() => {
    const count = code.split("\n").length;
    let text = "1";
    for (let i = 2; i <= count; i++) text += "\n" + i;
    return text;
  }, [code]);

  // Moving the highlight layer with a transform keeps it aligned even when the
  // textarea shows scrollbars, which shrink its scroll range below the layer's
  const syncScroll = () => {
    const ta = editorRef.current;
    const pre = preRef.current;
    const gutter = gutterRef.current;
    if (ta && pre) {
      pre.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    }
    // the gutter only follows vertical scrolling
    if (ta && gutter) {
      gutter.style.transform = `translateY(${-ta.scrollTop}px)`;
    }
  };

  // -------- Effects --------
  useEffect(() => {
    setFiles(listFiles());
    return () => {
      terminateWorker();
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const el = outRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [output]);

  // Re-align after the content changes, for example when a file is opened
  useEffect(() => {
    syncScroll();
  }, [code]);

  // Console output, errors and test status from the preview iframe or the app test window
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || !d.idex) return;

      if (typeof d.run === "number") {
        // messages from an app test window carry the run id, ignore stale runs
        if (d.run !== runIdRef.current) return;
      } else {
        const frame = frameRef.current;
        if (!frame || e.source !== frame.contentWindow) return;
      }

      if (d.type === "out" || d.type === "err") {
        pushLine(d.type, String(d.text));
      } else if (d.type === "status") {
        setCheck({
          code: runCodeRef.current,
          ok: !!d.ok,
          compiled: compiledRef.current,
          hasIcon: !!d.hasIcon,
          title: typeof d.title === "string" ? d.title : null,
        });
        if (d.ok) {
          pushLine(
            "sys",
            d.hasIcon
              ? "App ran without errors and the icon passed. You can install it."
              : "App ran without errors. No Icon export, so the default icon will be used. You can install it.",
          );
        } else {
          pushLine("err", String(d.error ?? "The app failed to run."));
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // -------- Notices and output --------
  const flash = (kind: "ok" | "error", text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ kind, text });
    if (kind === "ok") {
      noticeTimer.current = setTimeout(() => setNotice(null), 2500);
    }
  };

  const pushLine = (kind: Line["kind"], text: string) => {
    setOutput((prev) => [...prev, { kind, text }].slice(-MAX_OUTPUT_LINES));
  };

  // -------- Runner --------
  function terminateWorker() {
    workerRef.current?.terminate();
    workerRef.current = null;
    if (workerUrlRef.current) URL.revokeObjectURL(workerUrlRef.current);
    workerUrlRef.current = null;
  }

  const getWorker = () => {
    if (workerRef.current) return workerRef.current;
    const url = URL.createObjectURL(
      new Blob([WORKER_SOURCE], { type: "text/javascript" }),
    );
    const worker = new Worker(url);
    worker.onmessage = (e: MessageEvent<{ type: string; text?: string }>) => {
      const { type, text } = e.data;
      if (type === "done") setRunning(false);
      else if (type === "compiled") {
        // the compiled app opens in its own window, which reports back with the run id
        const compiled = text ?? "";
        compiledRef.current = compiled;
        runIdRef.current = useCustomApps.getState().runTest({
          title: `${testBaseRef.current} (test)`,
          source: runCodeRef.current,
          compiled,
          hasIcon: /\bexports\.Icon\b/.test(compiled),
        });
        pushLine("sys", "Compiled. Opening test window...");
      } else if (type === "out" || type === "err" || type === "sys") {
        pushLine(type, text ?? "");
      }
    };
    worker.onerror = (e) => {
      pushLine("err", e.message || "The runner crashed.");
      setRunning(false);
    };
    workerRef.current = worker;
    workerUrlRef.current = url;
    return worker;
  };

  const run = () => {
    if (running) return;
    setShowOutput(true);

    if (!runKind) {
      setOutput([
        {
          kind: "sys",
          text: `${LANGS[lang].label} can't run in the browser. You can still edit, save, and download it.`,
        },
      ]);
      return;
    }

    setOutput([]);

    if (lang === "app") {
      // a new run invalidates the previous result until the test window reports back
      setCheck(null);
      runCodeRef.current = code;
      testBaseRef.current = safeBase(base);
      runIdRef.current = null;
    }

    if (runKind === "preview") {
      const html =
        lang === "html"
          ? buildHtmlPreview(code)
          : buildReactPreview(code, lang === "tsx");
      setPreview({ html, key: Date.now() });
      pushLine("sys", "Preview updated.");
      return;
    }

    if (runKind === "xml") {
      const doc = new DOMParser().parseFromString(code, "application/xml");
      const problem = doc.getElementsByTagName("parsererror")[0];
      if (problem) pushLine("err", (problem.textContent ?? "Invalid XML").trim());
      else pushLine("sys", "XML is well-formed.");
      return;
    }

    setRunning(true);
    try {
      getWorker().postMessage({ lang, code });
    } catch {
      pushLine("err", "Could not start the runner in this browser.");
      setRunning(false);
    }
  };

  const stop = () => {
    if (!running) return;
    terminateWorker();
    setRunning(false);
    pushLine("sys", "Stopped.");
  };

  const clearOutput = () => setOutput([]);

  // -------- File actions --------
  const confirmDiscard = () =>
    !dirty || window.confirm("You have unsaved changes. Discard them?");

  const newFile = () => {
    if (!confirmDiscard()) return;
    setCode("");
    setSavedCode("");
    setBase("untitled");
    setCheck(null);
    editorRef.current?.focus();
  };

  const save = () => {
    const result = saveFile(filename, safeBase(base), lang, code);
    if (result.ok) {
      setSavedCode(code);
      setFiles(listFiles());
      flash("ok", `Saved ${filename} to this browser`);
    } else {
      flash("error", result.error);
    }
  };

  const download = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openStored = (meta: StoredMeta) => {
    if (!confirmDiscard()) return;
    const text = loadFile(meta);
    if (text === null) {
      flash("error", `${meta.name} is damaged and could not be loaded.`);
      return;
    }
    setCode(text);
    setSavedCode(text);
    setLang(isLang(meta.lang) ? meta.lang : "plaintext");
    setBase(meta.base);
    setCheck(null);
  };

  const deleteCurrent = () => {
    const meta = files.find((f) => f.name === filename);
    if (!meta) return;
    if (!window.confirm(`Delete the saved copy of ${filename}?`)) return;
    deleteStored(meta);
    setFiles(listFiles());
    flash("ok", `Deleted ${filename} from this browser`);
  };

  // -------- App actions --------
  const installApp = () => {
    if (!check || !installable) {
      flash("error", "Run the app without errors before installing it.");
      return;
    }
    const title = (check.title ?? "").trim() || safeBase(base);
    const result = useCustomApps.getState().install({
      title,
      source: code,
      compiled: check.compiled,
      hasIcon: check.hasIcon,
    });
    if (result.ok) flash("ok", `Installed ${title}. Find it on the desktop and start menu.`);
    else flash("error", result.error);
  };

  const showAppGuide = () => {
    setShowOutput(true);
    setOutput(APP_GUIDE.map((text) => ({ kind: "sys" as const, text })));
  };

  const insertExample = () => {
    if (!confirmDiscard()) return;
    setLang("app");
    setBase("counter");
    setCode(EXAMPLE_APP);
    setSavedCode("");
    setCheck(null);
  };

  // -------- Editor actions --------
  const editorCommand = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command);
  };

  const selectAll = () => {
    editorRef.current?.focus();
    editorRef.current?.select();
  };

  const insertAtCursor = (text: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    if (!document.execCommand("insertText", false, text)) {
      el.setRangeText(text, el.selectionStart, el.selectionEnd, "end");
      setCode(el.value);
    }
  };

  const showShortcuts = () => {
    setShowOutput(true);
    setOutput([
      { kind: "sys", text: "Ctrl+Enter  Run" },
      { kind: "sys", text: "Ctrl+S  Save to this browser" },
      { kind: "sys", text: "Ctrl+Shift+S  Download" },
    ]);
  };

  // -------- Keyboard --------
  const onSectionKeyDown = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    // browser autofill can fire keydown events with no key
    const key = String(e.key ?? "").toLowerCase();
    if (mod && key === "s") {
      e.preventDefault();
      if (e.shiftKey) download();
      else save();
    } else if (mod && key === "enter") {
      e.preventDefault();
      run();
    } else if (key === "escape") {
      setOpenMenu(null);
    }
  };

  const onEditorKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab adds an indenation
    if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();

      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const lineStart = el.value.lastIndexOf("\n", start - 1) + 1;
      const unit = LANGS[lang].indent;

      // Insert the indentation at the start of the current line.
      const value = el.value;
      const updatedValue =
        value.slice(0, start) + unit + value.slice(end);

      // Update React state through the normal change handler.
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;

      nativeInputValueSetter?.call(el, updatedValue);
      el.dispatchEvent(new Event("input", { bubbles: true }));

      // Preserve the selection, accounting for the inserted indentation.
      el.setSelectionRange(
        start + unit.length,
        start + unit.length,
      );

      return;
    }

    // Shift+Tab removes one indent level from the current line
    if (e.key === "Tab" && e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const lineStart = el.value.lastIndexOf("\n", start - 1) + 1;
      const lead = el.value.slice(lineStart).match(/^[ \t]*/)![0];
      const unit = LANGS[lang].indent;
      const n = lead.startsWith("\t")
        ? 1
        : Math.min(lead.length - lead.replace(/^ +/, "").length, unit.length);
      if (n === 0) return;
      el.setSelectionRange(lineStart, lineStart + n);
      document.execCommand("delete");
      // keep the caret where it was relative to the text
      const pos = Math.max(lineStart, start - n);
      el.setSelectionRange(pos, pos);
      return;
    }

    // Typing a closing bracket on a whitespace-only line removes one indent level
    if (
      CLOSE_CHARS.has(e.key) &&
      lang !== "plaintext" &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.nativeEvent.isComposing
    ) {
      const el = e.currentTarget;
      const start = el.selectionStart;
      if (start === el.selectionEnd) {
        const lineStart = el.value.lastIndexOf("\n", start - 1) + 1;
        const prefix = el.value.slice(lineStart, start);
        if (prefix.length > 0 && /^[ \t]+$/.test(prefix)) {
          e.preventDefault();
          const n = unitLength(prefix, LANGS[lang].indent);
          // select the indent unit so typing the bracket replaces it
          el.setSelectionRange(start - n, start);
          insertAtCursor(e.key);
          return;
        }
      }
    }

    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const { text, caret } = autoIndent(el.value, start, el.selectionEnd, lang);
      insertAtCursor(text);
      // place the caret on the indented line, not after the closing bracket
      const pos = start + caret;
      el.setSelectionRange(pos, pos);
    }
  };

  // -------- Menus --------
  const hasSavedCopy = files.some((f) => f.name === filename);

  const menus: { name: string; items: MenuItem[] }[] = [
    {
      name: "File",
      items: [
        { label: "New", onClick: newFile },
        { label: "Save to browser", hint: "Ctrl+S", onClick: save },
        { label: "Download", hint: "Ctrl+Shift+S", onClick: download },
        {
          label: "Delete saved copy",
          onClick: deleteCurrent,
          disabled: !hasSavedCopy,
        },
        { label: "", separator: true },
        { label: "Install as app", onClick: installApp, disabled: !installable },
        ...customApps.map((a) => ({
          label: `Uninstall ${a.title}`,
          onClick: () => useCustomApps.getState().uninstall(a.id),
        })),
        { label: "", separator: true },
        {
          label: files.length ? "Open saved file" : "No saved files yet",
          header: true,
        },
        ...files.map((f) => ({
          label: f.name,
          hint: formatSize(f.size),
          checked: f.name === filename,
          onClick: () => openStored(f),
        })),
      ],
    },
    {
      name: "Edit",
      items: [
        { label: "Undo", onClick: () => editorCommand("undo") },
        { label: "Redo", onClick: () => editorCommand("redo") },
        { label: "Select all", onClick: selectAll },
      ],
    },
    {
      name: "View",
      items: [
        {
          label: "Output panel",
          checked: showOutput,
          onClick: () => setShowOutput((v) => !v),
        },
        {
          label: "Preview panel",
          checked: preview !== null,
          disabled: preview === null,
          onClick: () => setPreview(null),
        },
      ],
    },
    {
      name: "Format",
      items: [
        { label: "Language", header: true },
        ...LANG_LIST.map((l) => ({
          label: LANGS[l].label,
          hint: LANGS[l].run ? undefined : "edit only",
          checked: lang === l,
          onClick: () => setLang(l),
        })),
      ],
    },
    {
      name: "Run",
      items: [
        {
          label: "Run",
          hint: "Ctrl+Enter",
          onClick: run,
          disabled: running || !canRun,
        },
        { label: "Stop", onClick: stop, disabled: !running },
        { label: "Clear output", onClick: clearOutput },
      ],
    },
    {
      name: "Help",
      items: [
        { label: "Keyboard shortcuts", onClick: showShortcuts },
        { label: "How to build custom apps", onClick: showAppGuide },
        { label: "Create template app", onClick: insertExample },
      ],
    },
  ];

  return (
    <section
      className="flex h-full flex-col overflow-hidden text-fg"
      onKeyDown={onSectionKeyDown}
    >
      <nav
        ref={navRef}
        className="flex shrink-0 flex-wrap items-center gap-x-1 gap-y-1 border-b border-line bg-slate-200/5 px-2.5 py-1 text-xs text-fg/80 select-none"
      >
        {menus.map((menu) => {
          const isOpen = openMenu === menu.name;
          return (
            <div key={menu.name} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                className={`cursor-default rounded px-2 py-0.5 ${
                  isOpen ? "bg-white/10" : "hover:bg-white/10"
                }`}
                onClick={() => setOpenMenu(isOpen ? null : menu.name)}
                onMouseEnter={() => {
                  if (openMenu) setOpenMenu(menu.name);
                }}
              >
                {menu.name}
              </button>
              {isOpen && (
                <div
                  role="menu"
                  className="glass absolute top-full left-0 z-50 mt-1 max-h-80 min-w-52 overflow-y-auto rounded-lg py-1"
                >
                  {menu.items.map((item, i) => {
                    if (item.separator) {
                      return (
                        <div key={i} className="my-1 border-t border-line" />
                      );
                    }
                    if (item.header) {
                      return (
                        <div key={i} className="px-3 py-1 text-dim">
                          {item.label}
                        </div>
                      );
                    }
                    return (
                      <button
                        key={i}
                        type="button"
                        role="menuitem"
                        disabled={item.disabled}
                        className="flex w-full cursor-default items-center gap-2 px-3 py-1.5 text-left hover:bg-accent/25 disabled:opacity-40 disabled:hover:bg-transparent"
                        onClick={() => {
                          item.onClick?.();
                          setOpenMenu(null);
                        }}
                      >
                        <span className="w-3 text-accent-2">
                          {item.checked ? "\u2713" : ""}
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.hint && (
                          <span className="text-dim">{item.hint}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-0.5">
            <span className="sr-only">File name</span>
            <input
              value={base}
              onChange={(e) => setBase(e.target.value)}
              spellCheck={false}
              className="w-28 rounded border border-line bg-transparent px-1.5 py-0.5 outline-none focus:border-accent"
            />
            <span className="text-dim">{LANGS[lang].ext}</span>
            {dirty && (
              <span
                className="pl-1 text-accent-2"
                title="Unsaved changes"
                aria-label="Unsaved changes"
              >
                {"\u25CF"}
              </span>
            )}
          </label>
          <select
            aria-label="Language"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="rounded border border-line bg-raised px-1.5 py-0.5 text-fg outline-none focus:border-accent"
          >
            {LANG_LIST.map((l) => (
              <option key={l} value={l} className="bg-raised">
                {LANGS[l].label}
              </option>
            ))}
          </select>
          {lang === "app" && (
            <button
              type="button"
              onClick={installApp}
              disabled={!installable}
              title={
                installable
                  ? "Install this app"
                  : "Run the app without errors to unlock install"
              }
              className="rounded border border-line px-2 py-0.5 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Install
            </button>
          )}
          <button
            type="button"
            onClick={download}
            className="rounded border border-line px-2 py-0.5 hover:bg-white/10"
          >
            Download
          </button>
          {running ? (
            <button
              type="button"
              onClick={stop}
              className="rounded bg-[#ff5c7a] px-2.5 py-0.5 font-medium text-white hover:brightness-110"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={run}
              disabled={!canRun}
              title={
                canRun
                  ? "Run (Ctrl+Enter)"
                  : `${LANGS[lang].label} can't run in the browser (edit only)`
              }
              className="rounded bg-accent px-2.5 py-0.5 font-medium text-white hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
            >
              Run
            </button>
          )}
        </div>
      </nav>

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`flex shrink-0 items-start justify-between gap-2 px-2.5 py-1 text-xs ${
            notice.kind === "error"
              ? "bg-[#ff5c7a]/15 text-[#ff7c94]"
              : "bg-accent-2/10 text-accent-2"
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="shrink-0 px-1"
            onClick={() => setNotice(null)}
          >
            {"\u00D7"}
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1">
          <div
            aria-hidden="true"
            className="shrink-0 overflow-hidden border-r border-line text-right text-dim select-none"
          >
            <pre
              ref={gutterRef}
              className="m-0 px-3 pt-2.5 pb-2 font-mono text-sm leading-5 whitespace-pre"
            >
              {lineNumbers}
            </pre>
          </div>

          <div className="relative min-h-0 min-w-0 flex-1">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <pre
                ref={preRef}
                className={`${EDITOR_TEXT} m-0 min-h-full w-max min-w-full bg-transparent`}
                dangerouslySetInnerHTML={{ __html: highlighted + "\n" }}
              />
            </div>
            <textarea
              ref={editorRef}
              aria-label="Code editor"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={onEditorKeyDown}
              onScroll={syncScroll}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              wrap="off"
              className={`${EDITOR_TEXT} absolute inset-0 h-full w-full resize-none overflow-auto border-0 bg-transparent text-transparent caret-fg outline-none focus:ring-0`}
              style={{
                border: "none",
                outline: "none",
                boxShadow: "none",
              }}
            />
          </div>
        </div>

        {preview && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-line md:border-t-0 md:border-l">
            <div className="flex shrink-0 items-center justify-between border-b border-line px-2.5 py-1 text-xs text-dim select-none">
              <span>Preview</span>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded px-1.5 hover:bg-white/10 hover:text-fg"
              >
                Close
              </button>
            </div>
            <iframe
              ref={frameRef}
              key={preview.key}
              title="Preview"
              sandbox="allow-scripts"
              srcDoc={preview.html}
              className="min-h-0 flex-1 bg-white"
            />
          </div>
        )}
      </div>

      {showOutput && (
        <div className="flex h-40 shrink-0 flex-col border-t border-line bg-black/20">
          <div className="flex shrink-0 items-center justify-between border-b border-line px-2.5 py-1 text-xs text-dim select-none">
            <span>Output</span>
            <button
              type="button"
              onClick={clearOutput}
              className="rounded px-1.5 hover:bg-white/10 hover:text-fg"
            >
              Clear
            </button>
          </div>
          <div
            ref={outRef}
            role="log"
            aria-live="polite"
            className="min-h-0 flex-1 overflow-auto p-2 font-mono text-xs"
          >
            {output.map((line, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap ${
                  line.kind === "err"
                    ? "text-[#ff7c94]"
                    : line.kind === "sys"
                      ? "text-dim"
                      : "text-fg"
                }`}
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
