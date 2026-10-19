import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

class N {
  constructor(t) { this.nodeType = t; this.childNodes = []; this.attrs = {}; this.parentElement = null; }
  get textContent() { return this.nodeType === 3 ? this.nodeValue : this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { this.childNodes = []; }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  appendChild(n) { n.parentElement = this; this.childNodes.push(n); return n; }
  removeChild(n) { return n; } remove() {} cloneNode() { return this; } contains() { return false; }
  hasAttribute(k) { return k in this.attrs; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  get className() { return this.attrs.class || ""; }
  get classList() {
    const s = this;
    const cls = () => String(s.attrs.class || "").split(/\s+/).filter(Boolean);
    return { contains: (c) => cls().includes(c), add: (c) => { s.attrs.class = cls().concat(c).join(" "); } };
  }
  querySelector(sel) { return Q(this, sel)[0] ?? null; }
  querySelectorAll(sel) { return Q(this, sel); }
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
  (function walk(n) { for (const c of n.childNodes) { if (c.nodeType !== 1) continue; if (match(c, sel)) out.push(c); walk(c); } })(root);
  return out;
}
const T = (v) => { const n = new N(3); n.nodeValue = v; return n; };
const el = (tag, attrs, kids = []) => {
  const n = new E(tag); Object.assign(n.attrs, attrs ?? {});
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
assert.ok(t && typeof t.codeLanguage === "function", "缺少 codeLanguage 测试入口");

// 场景：DSH 用 shiki 渲染，DOM 上没有 language-xxx，语言信息丢失
// 期望：靠内容嗅探识别出来
const cases = [
  ["flowchart TD\n  A --> B", "mermaid"],
  ["graph LR\n  A --> B", "mermaid"],
  ["sequenceDiagram\n  A->>B: hi", "mermaid"],
  ["stateDiagram-v2\n  [*] --> A", "mermaid"],
  ["gantt\n  title x", "mermaid"],
  ["digraph G { A -> B; }", "graphviz"],
  ["@startuml\nA -> B\n@enduml", "plantuml"],
  ["const x = 1;\nconsole.log(x);", ""],
  ["function foo() { return 1; }", ""],
  ["def foo():\n    pass", ""],
];

let pass = 0;
for (const [content, expected] of cases) {
  const pre = el("pre", {}, [el("code", {}, [content])]);
  const got = t.codeLanguage(pre);
  const ok = got === expected;
  console.log((ok ? "  ✓ " : "  ✗ ") + JSON.stringify(content.split("\n")[0]).slice(0, 30) + " → " + JSON.stringify(got) + (ok ? "" : " (期望 " + JSON.stringify(expected) + ")"));
  if (ok) pass += 1;
}
assert.equal(pass, cases.length, "有 " + (cases.length - pass) + " 个用例未通过");

// 站位词应被忽略
const placeholder = el("pre", { class: "language" }, [el("code", {}, ["plain text"])]);
assert.equal(t.codeLanguage(placeholder), "", "占位词 language 不应被当成语言");

// 显式 language-xxx 仍然优先
const explicit = el("pre", { class: "language-python" }, [el("code", {}, ["def f(): pass"])]);
assert.equal(t.codeLanguage(explicit), "python");

console.log("\n全部断言通过（" + pass + " 个嗅探用例 + 2 个边界）");
process.exit(0);
