import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

class N {
  constructor(t) { this.nodeType = t; this.childNodes = []; this.attrs = {}; this._text = ""; this.parentElement = null; }
  get textContent() { return this.nodeType === 3 ? this.nodeValue : this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { this._text = String(v); this.childNodes = []; }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  appendChild(n) { n.parentElement = this; this.childNodes.push(n); return n; }
  removeChild(n) { return n; } remove() {} cloneNode() { return this; } contains() { return false; }
  hasAttribute(k) { return k in this.attrs; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  get className() { return this.attrs.class || ""; }
  get classList() {
    const self = this;
    const cls = () => String(self.attrs.class || "").split(/\s+/).filter(Boolean);
    return { contains: (c) => cls().includes(c), add: (c) => { self.attrs.class = cls().concat(c).join(" "); } };
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
  (function walk(node) {
    for (const c of node.childNodes) {
      if (c.nodeType !== 1) continue;
      if (match(c, sel)) out.push(c);
      walk(c);
    }
  })(root);
  return out;
}
const T = (v) => { const n = new N(3); n.nodeValue = v; return n; };
const el = (tag, attrs, kids = []) => {
  const n = new E(tag); Object.assign(n.attrs, attrs ?? {});
  for (const k of kids) n.appendChild(typeof k === "string" ? T(k) : k);
  return n;
};

// mermaid 代码块：pre > code.language-mermaid
const mermaidPre = el("pre", { class: "md-code-block language-mermaid" }, [
  el("code", { class: "language-mermaid" }, ["flowchart TD", "    A[开始] --> B{判断}", "    B -->|是| C[执行]", "    B -->|否| D[结束]"].join("\n")),
]);

// mindmap 代码块
const mindPre = el("pre", { class: "language-mindmap" }, [
  el("code", {}, ["mindmap", "  root((主题))", "    分支A", "    分支B"].join("\n")),
]);

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
assert.ok(t, "测试钩子未暴露");

const row = el("div", { "data-chat-flow-key": "k", "data-chat-turn": "0", "data-chat-flow-kind": "assistant-step" }, [mermaidPre, mindPre]);
const md = t.serializeRow(row);
console.log("--- 序列化结果 ---");
console.log(md);
console.log("------------------");

assert.ok(md.includes("~~~mermaid"), "mermaid 语言标记丢失");
assert.ok(md.includes("flowchart TD"), "mermaid 内容丢失");
assert.ok(md.includes("B{判断}"), "mermaid 节点语法丢失");
assert.ok(md.includes("~~~mindmap"), "mindmap 语言标记丢失");
assert.ok(md.includes("root((主题))"), "mindmap 内容丢失");

console.log("\n全部断言通过");
process.exit(0);
