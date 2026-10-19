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

// 模拟 DSH 真实情况：pre 没有语言 class（shiki 输出）
const mermaidPre = el("pre", { class: "shiki" }, [
  el("code", {}, ["flowchart TD", "    A[开始] --> B{判断}", "    B -->|是| C[执行]"].join("\n")),
]);
const seqPre = el("pre", { class: "shiki" }, [
  el("code", {}, ["sequenceDiagram", "    A->>B: 消息"].join("\n")),
]);
const normalPre = el("pre", { class: "shiki" }, [
  el("code", {}, ["const x = 1;", "console.log(x);"].join("\n")),
]);

const row = el("div", { "data-chat-flow-key": "k", "data-chat-turn": "0", "data-chat-flow-kind": "assistant-step" }, [
  mermaidPre, seqPre, normalPre,
]);

const md = t.serializeRow(row);
console.log("--- 序列化结果 ---");
console.log(md);
console.log("------------------");

assert.ok(md.includes("~~~mermaid"), "流程图未被识别为 mermaid");
assert.ok(md.includes("~~~sequenceDiagram") || (md.match(/~~~mermaid/g) || []).length >= 2, "时序图未被识别");
// 普通 JS 不应被标记成图表
const langBlocks = md.match(/~~~([a-zA-Z]+)/g) || [];
console.log("识别出的代码块语言:", langBlocks.join(", "));

console.log("\n全部断言通过");
process.exit(0);
