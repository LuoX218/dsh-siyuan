import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

// 完整度更高的 DOM 模拟
class N {
  constructor(t) { this.nodeType = t; this.childNodes = []; this.attrs = {}; this.parentElement = null; }
  get textContent() { return this.nodeType === 3 ? (this.nodeValue || "") : this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { this.childNodes = []; }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  appendChild(n) { if (n) { n.parentElement = this; this.childNodes.push(n); } return n; }
  removeChild(n) { return n; } remove() {} cloneNode() { return this; } contains() { return false; }
  hasAttribute(k) { return k in this.attrs; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  get className() { return this.attrs.class || ""; }
  get classList() {
    const s = this;
    const cls = () => String(s.attrs.class || "").split(/\s+/).filter(Boolean);
    return {
      contains: (c) => cls().includes(c),
      add: (c) => { const list = cls(); if (!list.includes(c)) { list.push(c); s.attrs.class = list.join(" "); } },
      toString: () => s.attrs.class || "",
    };
  }
  querySelector(sel) { return Q(this, sel)[0] ?? null; }
  querySelectorAll(sel) { return Q(this, sel); }
  get innerText() { return this.textContent; }
}
class E extends N { constructor(t) { super(1); this.tagName = t.toUpperCase(); this.attrs = {}; } }

function match(n, sel) {
  return sel.split(",").some((raw) => {
    const s = raw.trim();
    if (!s) return false;
    if (s.startsWith(".")) return n.classList.contains(s.slice(1));
    if (s.startsWith("[")) {
      const body = s.slice(1, -1);
      const eq = body.indexOf("=");
      if (eq < 0) return n.hasAttribute(body);
      return n.getAttribute(body.slice(0, eq)) === body.slice(eq + 1).replace(/^['"]|['"]$/g, "");
    }
    return n.tagName === s.toUpperCase();
  });
}
function Q(root, sel) {
  const out = [];
  (function walk(node) {
    for (const c of node.childNodes) {
      if (!c || c.nodeType !== 1) continue;
      if (match(c, sel)) out.push(c);
      walk(c);
    }
  })(root);
  return out;
}
const T = (v) => { const n = new N(3); n.nodeValue = v; return n; };
const el = (tag, attrs, kids = []) => {
  const n = new E(tag);
  Object.assign(n.attrs, attrs ?? {});
  for (const k of kids) n.appendChild(typeof k === "string" ? T(k) : k);
  return n;
};

let factory = null;
const sandbox = {
  __DSH_SIYUAN_TEST__: true,
  window: { setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {}, removeEventListener: () => {}, __ModuleLoader__: { load: (r) => { factory = r.factory; } } },
  document: {
    head: new E("head"), body: new E("body"),
    createElement: (t) => { const e = new E(t); e.dataset = {}; return e; },
    createTextNode: T, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
  },
  console, URL, Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
  AbortController, Element: E, location: { protocol: "dsh-app:" },
  setTimeout: () => 0, clearTimeout: () => {},
  CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i?.detail; } },
  fetch: async () => ({ ok: true, status: 200, text: async () => "{}" }),
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(SOURCE, sandbox, { filename: "client.js" });
const ex = factory((s) => (s === "react" ? { createElement: () => null, Fragment: "F", useState: (v) => [v, () => {}], useEffect: () => {}, useCallback: (f) => f, useMemo: (f) => f(), useRef: (v) => ({ current: v }) } : { createPortal: (n) => n }));

const t = ex.__test;

// 【关键场景】模拟 DSH 真实渲染：pre.shiki 里 code 包含 span.line，带零宽字符
const NL = "\n";
const ZW = "\u200b";

function shikiPre(lines) {
  const code = el("code", {}, []);
  lines.forEach((line) => {
    code.appendChild(el("span", { class: "line" }, [line + ZW]));
  });
  return el("pre", { class: "shiki shiki-themes github-dark", tabindex: "0" }, [code]);
}

const cases = [
  { name: "流程图", lines: ["flowchart TD", "    A[开始] --> B[结束]"], expect: "mermaid" },
  { name: "时序图", lines: ["sequenceDiagram", "    A->>B: hi"], expect: "mermaid" },
  { name: "状态图", lines: ["stateDiagram-v2", "    [*] --> A"], expect: "mermaid" },
  { name: "甘特图", lines: ["gantt", "    title x"], expect: "mermaid" },
  { name: "mindmap", lines: ["mindmap", "  root((主题))"], expect: "mermaid" },
  { name: "graphviz", lines: ["digraph G {", "  A -> B;", "}"], expect: "graphviz" },
  { name: "普通 JS", lines: ["const x = 1;", "console.log(x);"], expect: "" },
  { name: "普通 Python", lines: ["def f():", "    pass"], expect: "" },
];

let pass = 0;
console.log("=== 模拟 shiki 真实 DOM ===");
for (const c of cases) {
  const pre = shikiPre(c.lines);
  const got = t.codeLanguage(pre);
  const ok = got === c.expect;
  console.log((ok ? "  ✓ " : "  ✗ ") + c.name.padEnd(10) + " → " + JSON.stringify(got) + (ok ? "" : "  期望=" + JSON.stringify(c.expect)));
  if (ok) pass += 1;
}
assert.equal(pass, cases.length, pass + "/" + cases.length + " 通过");

// 序列化后检查语言标记是否落到 Markdown 里
const row = el("div", { "data-chat-flow-key": "k", "data-chat-turn": "0", "data-chat-flow-kind": "assistant-step" }, [
  shikiPre(["flowchart TD", "    A --> B"]),
]);
const md = t.serializeRow(row);
console.log("=== 最终 Markdown ===");
console.log(md);
assert.ok(md.includes("mermaid"), "Markdown 里没有 mermaid 标记");

console.log("\n全部断言通过");
process.exit(0);
