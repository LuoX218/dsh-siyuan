import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

class N { constructor(t){this.nodeType=t;this.childNodes=[];this.parentNode=null;this.attrs={};} get textContent(){return this.nodeType===3?this.nodeValue:this.childNodes.map(c=>c.textContent).join("");} set textContent(v){this.childNodes=[];} get children(){return this.childNodes.filter(c=>c.nodeType===1);} appendChild(n){this.childNodes.push(n);return n;} removeChild(n){return n;} remove(){} cloneNode(){return this;} hasAttribute(k){return k in this.attrs;} getAttribute(k){return k in this.attrs?this.attrs[k]:null;} setAttribute(k,v){this.attrs[k]=String(v);} querySelector(){return null;} querySelectorAll(){return [];} }
class E extends N { constructor(t){super(1);this.tagName=t.toUpperCase();} }

const registrations = [];
const windowObj = {
  setTimeout: () => 0, clearTimeout: () => {},
  addEventListener: () => {}, removeEventListener: () => {},
  innerWidth: 1200, innerHeight: 800,
  __ModuleLoader__: { load: (r) => { windowObj.__f = r.factory; } },
};
const document = {
  head: new E("head"), body: new E("body"),
  createElement: (t) => new E(t),
  createTextNode: (v) => { const n = new N(3); n.nodeValue = v; return n; },
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener: () => {}, removeEventListener: () => {},
};
const sandbox = {
  window: windowObj, document, console, URL, Date, Math, JSON, Set, Map, Array, Object,
  String, Number, Boolean, RegExp, Error, Promise, AbortController, Element: E,
  location: { protocol: "dsh-app:", origin: "dsh-app://app" },
  setTimeout: () => 0, clearTimeout: () => {},
  CustomEvent: class { constructor(t,i){this.type=t;this.detail=i?.detail;} },
  fetch: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ config: {}, matched: false, reason: "unreachable", pending: 0 }) }),
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
const ex = windowObj.__f((s) => (s === "react" ? React : { createPortal: (n) => n }));

ex.apply({
  effect: (fn) => fn(),
  slots: {
    inject: (name, fn) => fn(),
    register: (options, component) => {
      registrations.push({ name: options.name, id: options.id, label: options.label, component });
      return () => {};
    },
  },
});

const names = registrations.map((r) => r.name + "#" + r.id);
console.log("注册的槽位:", names.join(", "));

assert.ok(names.includes("plugins.item#dsh-siyuan"), "未注册 plugins.item#dsh-siyuan");
assert.ok(names.includes("shell.overlay#siyuan-sync-overlay"), "缺少 overlay");
assert.ok(names.includes("conversation.chat.assistant-actions#siyuan-sync-action"), "缺少动作按钮");

const item = registrations.find((r) => r.name === "plugins.item");
console.log("条目 id:", item.id);
console.log("标签:", typeof item.label === "function" ? item.label() : item.label);

// summary 视图
const summaryTree = item.component({ view: "summary", controller: null });
console.log("summary 渲染:", summaryTree === null ? "null" : "ok");

// page 视图（内嵌面板）—— 用替身 controller
const fakeController = { closeDialog() {}, subscribe: () => () => {}, getState: () => ({ menu: null, dialog: false, toast: null }) };
let pageOk = false;
try {
  const tree = item.component({ view: "page", controller: fakeController, form: null });
  pageOk = tree !== null;
} catch (error) {
  console.log("page 渲染异常:", String(error));
}
console.log("page 渲染:", pageOk ? "ok" : "failed");
assert.ok(pageOk, "page 视图渲染失败");
assert.ok(summaryTree !== null, "summary 视图为空");

console.log("\n全部断言通过");
