import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
const BT = String.fromCharCode(96);

// ---- 最小 DOM ----
class N {
  constructor(t) { this.nodeType = t; this.childNodes = []; this.parentNode = null; this.attrs = {}; }
  contains(other) {
    if (other === this) return true;
    return this.childNodes.some((c) => c.nodeType === 1 && c.contains(other));
  }
  get textContent() { return this.nodeType === 3 ? this.nodeValue : this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { this.childNodes = []; }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  appendChild(n) { n.parentNode = this; this.childNodes.push(n); return n; }
  removeChild(n) { return n; }
  remove() {}
  cloneNode() { return this; }
  hasAttribute(k) { return k in this.attrs; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  querySelector(sel) { return Q(this, sel)[0] ?? null; }
  querySelectorAll(sel) { return Q(this, sel); }
}
class E extends N { constructor(t) { super(1); this.tagName = t.toUpperCase(); } }

function match(n, sel) {
  return sel.split(",").some((raw) => {
    const s = raw.trim();
    if (!s) return false;
    const tagMatch = /^([a-zA-Z][a-zA-Z0-9]*)/.exec(s);
    if (tagMatch !== null && n.tagName !== tagMatch[1].toUpperCase()) return false;
    const attrs = s.match(/\[[^\]]+\]/g) ?? [];
    for (const part of attrs) {
      const body = part.slice(1, -1);
      const eq = body.indexOf("=");
      if (eq < 0) {
        if (!n.hasAttribute(body)) return false;
      } else {
        const want = body.slice(eq + 1).replace(/^['"]|['"]$/g, "");
        if (n.getAttribute(body.slice(0, eq)) !== want) return false;
      }
    }
    return tagMatch !== null || attrs.length > 0;
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
  const n = new E(tag);
  Object.assign(n.attrs, attrs ?? {});
  for (const k of kids) n.appendChild(typeof k === "string" ? T(k) : k);
  return n;
};

// ---- 构造两轮对话的窗口 ----
const root = el("div", {}, [
  el("div", { "data-chat-flow-key": "t0u", "data-chat-turn": "0", "data-chat-flow-kind": "user" }, [el("p", {}, ["第一轮的问题"])]),
  el("div", { "data-chat-flow-key": "t0a", "data-chat-turn": "0", "data-chat-flow-kind": "assistant-step" }, [el("p", {}, ["第一轮的回答"])]),
  el("div", { "data-chat-flow-key": "t1u", "data-chat-turn": "1", "data-chat-flow-kind": "user" }, [el("p", {}, ["第二轮的问题"])]),
  el("div", { "data-chat-flow-key": "t1a", "data-chat-turn": "1", "data-chat-flow-kind": "assistant-step" }, [el("p", {}, ["第二轮的回答"])]),
]);

const documentObj = {
  head: new E("head"),
  body: root,
  createElement: (t) => new E(t),
  createTextNode: T,
  querySelector: (sel) => Q(root, sel)[0] ?? Q(documentObj.head, sel)[0] ?? null,
  querySelectorAll: (sel) => Q(root, sel),
  addEventListener: () => {},
  removeEventListener: () => {},
};

let factory = null;
const sandbox = {
  __DSH_SIYUAN_TEST__: true,
  window: {
    setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {}, removeEventListener: () => {},
    innerWidth: 1200, innerHeight: 800,
    __ModuleLoader__: { load: (r) => { factory = r.factory; } },
  },
  document: documentObj,
  console, URL, Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
  AbortController, Element: E, location: { protocol: "dsh-app:", origin: "dsh-app://app" },
  setTimeout: () => 0, clearTimeout: () => {},
  CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i?.detail; } },
  fetch: async () => ({ ok: true, status: 200, text: async () => "{}" }),
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(SOURCE, sandbox, { filename: "client.js" });
const ex = factory((s) => (s === "react" ? { createElement: () => null, Fragment: "F", useState: (v) => [v, () => {}], useEffect: () => {}, useCallback: (f) => f, useMemo: (f) => f(), useRef: (v) => ({ current: v }) } : { createPortal: (n) => n }));

assert.ok(ex.__test, "测试钩子未暴露");
const t = ex.__test;
console.log("暴露的测试函数:", Object.keys(t).join(", "));

assert.ok(typeof t.serializeWindow === "function", "缺少 serializeWindow");
const snap = t.serializeWindow();
console.log("--- 全窗口序列化 ---");
console.log(snap.markdown);
console.log("轮次数:", snap.turns, "完整:", snap.complete, "首轮:", snap.firstTurn);

assert.equal(snap.turns, 2, "应识别 2 轮");
assert.ok(snap.markdown.includes("## 第 0 轮"), "缺少第 0 轮标题");
assert.ok(snap.markdown.includes("## 第 1 轮"), "缺少第 1 轮标题");
assert.ok(snap.markdown.includes("第一轮的问题"), "缺少内容");
assert.ok(snap.markdown.includes("第二轮的回答"), "缺少内容");
assert.ok(snap.complete === true, "无分页锚点时应为完整");

console.log("\n全部断言通过");