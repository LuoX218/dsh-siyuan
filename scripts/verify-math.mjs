import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

// ---- 最小 DOM，支持 classList / querySelector ----
class N {
  constructor(t) { this.nodeType = t; this.childNodes = []; this.attrs = {}; this._text = ""; this.parentElement = null; }
  get textContent() {
    if (this.nodeType === 3) return this.nodeValue;
    return this.childNodes.map((c) => c.textContent).join("");
  }
  set textContent(v) { this.childNodes = [{ nodeType: 3, nodeValue: String(v), textContent: String(v) }]; }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  appendChild(n) { n.parentElement = this; this.childNodes.push(n); return n; }
  removeChild(n) { return n; }
  remove() {}
  cloneNode() { return this; }
  contains() { return false; }
  hasAttribute(k) { return k in this.attrs; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  get classList() {
    const self = this;
    const cls = () => String(self.attrs.class || "").split(/\s+/).filter(Boolean);
    return {
      contains: (c) => cls().includes(c),
      add: (c) => { self.attrs.class = (cls().concat(c)).join(" "); },
    };
  }
  querySelector(sel) { return Q(this, sel)[0] ?? null; }
  querySelectorAll(sel) { return Q(this, sel); }
}
class E extends N { constructor(t) { super(1); this.tagName = t.toUpperCase(); this.attrs = {}; } }

function match(n, sel) {
  return sel.split(",").some((raw) => {
    const s = raw.trim();
    if (!s) return false;
    // [attr="value"] 或 .class 或 tag
    if (s.startsWith(".")) return n.classList.contains(s.slice(1));
    if (s.startsWith("[")) {
      const body = s.slice(1, -1);
      const eq = body.indexOf("=");
      if (eq < 0) return n.hasAttribute(body);
      const want = body.slice(eq + 1).replace(/^['"]|['"]$/g, "");
      return n.getAttribute(body.slice(0, eq)) === want;
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
  const n = new E(tag);
  Object.assign(n.attrs, attrs ?? {});
  for (const k of kids) n.appendChild(typeof k === "string" ? T(k) : k);
  return n;
};

// ---- 构造一个 KaTeX 行内公式 ----
const inlineKatex = el("span", { class: "katex" }, [
  el("span", { class: "katex-mathml" }, [
    el("math", {}, [el("semantics", {}, [
      el("annotation", { encoding: "application/x-tex" }, ["E=mc^2"]),
    ])]),
  ]),
  el("span", { class: "katex-html", "aria-hidden": "true" }, ["E = m c 2"]),
]);

// ---- 块级公式 ----
const blockKatex = el("span", { class: "katex-display" }, [
  el("span", { class: "katex" }, [
    el("span", { class: "katex-mathml" }, [
      el("math", {}, [el("semantics", {}, [
        el("annotation", { encoding: "application/x-tex" }, ["\\int_0^1 x^2 dx"]),
      ])]),
    ]),
    el("span", { class: "katex-html", "aria-hidden": "true" }, ["∫ 0 1 x 2 d x"]),
  ]),
]);

// ---- 构造一整个段落 ----
const para = el("p", {}, ["质能方程：", inlineKatex, "，这是结论。"]);
const blockPara = el("div", {}, [blockKatex]);

let factory = null;
const sandbox = {
  __DSH_SIYUAN_TEST__: true,
  window: { setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {}, removeEventListener: () => {}, __ModuleLoader__: { load: (r) => { factory = r.factory; } } },
  document: {
    head: new E("head"), body: new E("body"),
    createElement: (t) => { const e = new E(t); e.dataset = {}; return e; },
    createTextNode: T,
    querySelector: () => null, querySelectorAll: () => [],
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

// 用包装成 row 的方式调用 serializeRow
const row = el("div", { "data-chat-flow-key": "k", "data-chat-turn": "0", "data-chat-flow-kind": "assistant-step" }, [para, blockPara]);
const md = t.serializeRow(row);
console.log("--- 序列化结果 ---");
console.log(md);
console.log("------------------");

assert.ok(md.includes("$E=mc^2$"), "行内公式未正确输出");
assert.ok(!md.includes("E = m c 2"), "行内公式仍包含渲染后的重复文本");
assert.ok(md.includes("$$"), "块级公式缺少 $$");
assert.ok(md.includes("\\int_0^1 x^2 dx"), "块级公式 LaTeX 丢失");

const inlineCount = (md.match(/\$E=mc\^2\$/g) || []).length;
assert.equal(inlineCount, 1, "行内公式应只出现一次，实际 " + inlineCount);

console.log("\n全部断言通过");
process.exit(0);
