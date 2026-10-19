import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

class Node {
  constructor(t) { this.nodeType = t; this.childNodes = []; this.parentNode = null; }
  get textContent() { return this.nodeType === 3 ? this.nodeValue : this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { this.childNodes = [T(String(v))]; }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  appendChild(n) { n.parentNode = this; this.childNodes.push(n); return n; }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i >= 0) this.childNodes.splice(i, 1); return n; }
  remove() { this.parentNode && this.parentNode.removeChild(this); }
  cloneNode() { return clone(this); }
  hasAttribute(k) { return this.attrs != null && Object.prototype.hasOwnProperty.call(this.attrs, k); }
  getAttribute(k) { return this.attrs && this.hasAttribute(k) ? this.attrs[k] : null; }
  setAttribute(k, v) { (this.attrs ??= {})[k] = String(v); }
  querySelector(sel) { return find(this, (n) => match(n, sel))[0] ?? null; }
  querySelectorAll(sel) { return find(this, (n) => match(n, sel)); }
}
class E extends Node { constructor(t) { super(1); this.tagName = t.toUpperCase(); this.attrs = {}; this.className = ""; } }
const T = (v) => { const n = new Node(3); n.nodeValue = v; return n; };
function clone(n) { if (n.nodeType === 3) return T(n.nodeValue); const c = new E(n.tagName); c.attrs = { ...n.attrs }; c.className = n.className; for (const k of n.childNodes) c.appendChild(clone(k)); return c; }
function find(n, p, out = []) { for (const c of n.childNodes) { if (c.nodeType !== 1) continue; if (p(c)) out.push(c); find(c, p, out); } return out; }
function match(n, sel) {
  return sel.split(",").some((raw) => {
    const s = raw.trim();
    if (s === "") return false;
    if (s.startsWith("[") && s.endsWith("]")) {
      const body = s.slice(1, -1);
      const eq = body.indexOf("=");
      if (eq < 0) return n.hasAttribute(body);
      const key = body.slice(0, eq);
      const value = body.slice(eq + 1).replace(/^['"]|['"]$/g, "");
      return n.getAttribute(key) === value;
    }
    return n.tagName === s.toUpperCase();
  });
}
const e = (tag, attrs, kids = []) => { const n = new E(tag); Object.assign(n.attrs, attrs ?? {}); for (const k of kids) n.appendChild(typeof k === "string" ? T(k) : k); return n; };

const row = e("div", { "data-chat-flow-key": "k", "data-chat-turn": "3", "data-chat-flow-kind": "assistant-step" }, [
  e("div", { "data-actions-reveal": "hover" }, [e("button", {}, ["复制"])]),
  e("h2", {}, ["结论"]),
  e("p", {}, ["这是 ", e("strong", {}, ["加粗"]), " 与 ", e("code", {}, ["inline()"]), "。"]),
  e("pre", { class: "md-code-block language-ts" }, [e("code", {}, ["const a = 1;"])]),
  e("ul", {}, [e("li", {}, ["第一项"]), e("li", {}, ["第二项"])]),
  e("table", {}, [e("tr", {}, [e("th", {}, ["列A"]), e("th", {}, ["列B"])]), e("tr", {}, [e("td", {}, ["1"]), e("td", {}, ["2"])])]),
  e("a", { href: "https://example.com" }, ["链接"]),
  e("div", { "aria-hidden": "true" }, ["装饰"]),
]);

let factory = null;
const sandbox = {
  __DSH_SIYUAN_TEST__: true,
  window: { setTimeout: () => 0, addEventListener: () => {}, removeEventListener: () => {}, innerWidth: 1200, innerHeight: 800, __ModuleLoader__: { load: (r) => { factory = r.factory; } } },
  document: {
    head: new E("head"), body: new E("body"),
    createElement: (t) => new E(t), createTextNode: T,
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
  },
  console, URL, Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
  Element: E, setTimeout: () => 0, clearTimeout: () => {},
  CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i?.detail; } },
  fetch: async () => ({ ok: true, status: 200, text: async () => "{}" }),
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(SOURCE, sandbox, { filename: "client.js" });
const ex = factory((s) => (s === "react" ? { createElement: () => null, Fragment: "F", useState: (v) => [v, () => {}], useEffect: () => {}, useCallback: (f) => f, useMemo: (f) => f(), useRef: (v) => ({ current: v }) } : { createPortal: (n) => n }));

assert.ok(ex.__test, "测试钩子未暴露");
const t = ex.__test;

const md = t.serializeRow(row);
console.log("--- 序列化结果 ---");
console.log(md);
console.log("------------------");

const TICK = String.fromCharCode(96);
assert.ok(md.includes("## 结论"), "H2 未转换");
assert.ok(md.includes("**加粗**"), "加粗未转换");
assert.ok(md.includes(TICK + "inline()" + TICK), "行内代码未转换");
assert.ok(md.includes("~~~ts"), "代码块语言未带出");
assert.ok(md.includes("const a = 1;"), "代码块内容丢失");
assert.ok(md.includes("- 第一项"), "无序列表未转换");
assert.ok(md.includes("| 列A | 列B |"), "表格表头未转换");
assert.ok(md.includes("| --- | --- |"), "表格分隔行未转换");
assert.ok(md.includes("[链接](https://example.com)"), "链接未转换");
assert.ok(!md.includes("复制"), "按钮文本应被剔除");
assert.ok(!md.includes("装饰"), "aria-hidden 内容应被剔除");
assert.ok(t.kindOf(row) === "助手", "kindOf 判定错误");
assert.ok(t.documentTitle(md).length > 0, "标题为空");

console.log("\n全部断言通过");
