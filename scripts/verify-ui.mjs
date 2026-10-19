import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

class N {
  constructor(t){this.nodeType=t;this.childNodes=[];this.attrs={};this._text="";}
  get textContent(){return this._text;}
  set textContent(v){this._text=String(v);}
  get children(){return this.childNodes.filter(c=>c.nodeType===1);}
  appendChild(n){this.childNodes.push(n);return n;}
  removeChild(n){return n;} remove(){} cloneNode(){return this;} contains(){return false;}
  hasAttribute(k){return k in this.attrs;} getAttribute(k){return k in this.attrs?this.attrs[k]:null;}
  setAttribute(k,v){this.attrs[k]=String(v);} querySelector(){return null;} querySelectorAll(){return [];}
}
class E extends N { constructor(t){super(1);this.tagName=t.toUpperCase();} }

const heads = [];
const documentObj = {
  head: { appendChild: (el) => heads.push(el), querySelector: () => null },
  body: new E("body"),
  createElement: (t) => { const el = new E(t); el.dataset = {}; return el; },
  createTextNode: (v) => new N(3),
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener: () => {}, removeEventListener: () => {},
};

let factory = null;
const sandbox = {
  __DSH_SIYUAN_TEST__: true,
  window: { setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {}, removeEventListener: () => {}, innerWidth: 1440, innerHeight: 900, __ModuleLoader__: { load: (r) => { factory = r.factory; } } },
  document: documentObj, console, URL, Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
  AbortController, Element: E, location: { protocol: "dsh-app:", origin: "dsh-app://app" },
  setTimeout: () => 0, clearTimeout: () => {},
  CustomEvent: class { constructor(t,i){this.type=t;this.detail=i?.detail;} },
  fetch: async () => ({ ok: true, status: 200, text: async () => "{}" }),
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(SOURCE, sandbox, { filename: "client.js" });

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  Fragment: "Fragment",
  useState: (v) => [typeof v === "function" ? v() : v, () => {}],
  useEffect: () => {}, useCallback: (f) => f, useMemo: (f) => f(), useRef: (v) => ({ current: v }),
};
const ex = factory((s) => (s === "react" ? React : { createPortal: (n) => n }));

// 抽出样式表，检查关键规则
ex.apply({ effect: (fn) => fn(), slots: { inject: () => ({}), register: () => () => {} } });
assert.ok(heads.length > 0, "样式未注入");
const css = heads[0].textContent || "";

// 按钮必须用固定色，不能依赖可能翻白的主题变量
const primaryRule = (css.match(/\.siy-btn-primary\{[^}]*\}/) || [""])[0];
assert.ok(primaryRule.includes("#4d6bfe"), "主按钮缺少固定背景色");
assert.ok(primaryRule.includes("#fff"), "主按钮缺少白色文字");
assert.ok(!primaryRule.includes("var(--dsw-alias-button-primary-fill"), "主按钮仍依赖主题变量");
console.log("1. 按钮配色固定 OK");

// 布局相关类名都存在
for (const cls of [".siy-grid", ".siy-subhead", ".siy-meta", ".siy-spacer", ".siy-preview-text"]) {
  assert.ok(css.includes(cls), "缺少样式 " + cls);
}
console.log("2. 新布局样式齐全 OK");

// 预览组件渲染不崩
const regs = [];
ex.apply({ effect: (fn) => fn(), slots: { inject: (n, fn) => fn(), register: (o, comp) => { regs.push({ o, comp }); return () => {}; } } });
const overlay = regs.find((r) => r.o.name === "shell.overlay");
assert.ok(overlay, "缺少 overlay 槽位");
const tree = overlay.comp({
  controller: {
    subscribe: () => () => {},
    getState: () => ({ menu: null, dialog: false, toast: null, preview: { markdown: "测试正文", docTitle: "" } }),
    cancelPreview() {}, confirmPreview() {}, closeMenu() {}, openDialog() {}, syncRow() {}, syncTurn() {}, syncWindow() {},
  },
});
assert.ok(tree !== null, "overlay 渲染为空");
console.log("3. 预览面板渲染 OK");

console.log("\n全部断言通过");
process.exit(0);