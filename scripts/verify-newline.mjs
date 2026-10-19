import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

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
    return { contains: (c) => cls().includes(c), add: (c) => { const l = cls(); if (!l.includes(c)) { l.push(c); s.attrs.class = l.join(" "); } } };
  }
  querySelector(sel) { return Q(this, sel)[0] ?? null; }
  querySelectorAll(sel) { return Q(this, sel); }
}
class E extends N { constructor(t) { super(1); this.tagName = t.toUpperCase(); this.attrs = {}; } }
function match(n, sel) {
  return sel.split(",").some((raw) => {
    const s = raw.trim(); if (!s) return false;
    if (s.startsWith(".")) return n.classList.contains(s.slice(1));
    if (s.startsWith("[")) {
      const b = s.slice(1, -1); const eq = b.indexOf("=");
      if (eq < 0) return n.hasAttribute(b);
      return n.getAttribute(b.slice(0, eq)) === b.slice(eq + 1).replace(/^['"]|['"]$/g, "");
    }
    return n.tagName === s.toUpperCase();
  });
}
function Q(root, sel) { const out = []; (function w(n) { for (const c of n.childNodes) { if (c.nodeType !== 1) continue; if (match(c, sel)) out.push(c); w(c); } })(root); return out; }
const T = (v) => { const n = new N(3); n.nodeValue = v; return n; };
const el = (tag, attrs, kids = []) => { const n = new E(tag); Object.assign(n.attrs, attrs ?? {}); for (const k of kids) n.appendChild(typeof k === "string" ? T(k) : k); return n; };

let factory = null;
const sandbox = {
  __DSH_SIYUAN_TEST__: true,
  window: { setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {}, removeEventListener: () => {}, __ModuleLoader__: { load: (r) => { factory = r.factory; } } },
  document: { head: new E("head"), body: new E("body"), createElement: (t) => { const e = new E(t); e.dataset = {}; return e; }, createTextNode: T, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, removeEventListener: () => {} },
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
const ZW = "\u200b";

// 结构 A：标准 shiki（span.line）
const A = el("pre", { class: "shiki" }, [
  el("code", {}, [
    el("span", { class: "line" }, ["flowchart TD" + ZW]),
    el("span", { class: "line" }, ["    A[开始] --> B{判断}" + ZW]),
    el("span", { class: "line" }, ["    B -->|是| C[执行]" + ZW]),
  ]),
]);

// 结构 B：BR 分隔
const B = el("pre", { class: "language-mermaid" }, [
  el("code", {}, [
    T("flowchart TD"), el("br"), T("    A --> B"),
  ]),
]);

// 结构 C：只有纯文本 + \n
const C = el("pre", { class: "language-mermaid" }, [
  el("code", {}, ["flowchart TD\n    A --> B"]),
]);

const results = [
  ["A 标准 shiki", A],
  ["B BR 分隔", B],
  ["C 纯文本", C],
];

let pass = 0;
console.log("=== 换行保留测试 ===");
for (const [name, pre] of results) {
  const code = t.codeText ? t.codeText(pre) : "(unavailable)";
  const hasNewline = code.includes("\n");
  const ok = hasNewline && code.includes("flowchart");
  console.log((ok ? "  ✓ " : "  ✗ ") + name.padEnd(14) + " → " + JSON.stringify(code).slice(0, 60));
  if (ok) pass += 1;
}
assert.equal(pass, results.length, pass + "/" + results.length);

// 序列化后的 markdown 必须多行
const row = el("div", { "data-chat-flow-key": "k", "data-chat-turn": "0", "data-chat-flow-kind": "assistant-step" }, [A]);
const md = t.serializeRow(row);
console.log("=== 最终 Markdown ===");
console.log(md);
const bodyLines = md.split("\n").filter((l) => l.trim() !== "");
assert.ok(bodyLines.length >= 3, "代码块内容应至少 3 行，实际 " + bodyLines.length);

console.log("\n全部断言通过");
process.exit(0);
