import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const SOURCE = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
class N {
  constructor(t) { this.nodeType = t; this.childNodes = []; this.attrs = {}; this.parentElement = null; }
  get textContent() { return this.nodeType === 3 ? (this.nodeValue || "") : ""; }
  set textContent(v) {}
  get children() { return []; }
  appendChild(n) { return n; } removeChild(n) { return n; } remove() {} cloneNode() { return this; } contains() { return false; }
  hasAttribute() { return false; } getAttribute() { return null; } setAttribute() {}
  get className() { return ""; }
  get classList() { return { contains: () => false, add: () => {} }; }
  querySelector() { return null; } querySelectorAll() { return []; }
}
class E extends N { constructor(t) { super(1); this.tagName = t.toUpperCase(); } }
let factory = null;
const sandbox = {
  __DSH_SIYUAN_TEST__: true,
  window: { setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {}, removeEventListener: () => {}, __ModuleLoader__: { load: (r) => { factory = r.factory; } } },
  document: { head: new E("head"), body: new E("body"), createElement: (t) => { const e = new E(t); e.dataset = {}; return e; }, createTextNode: () => new N(3), querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, removeEventListener: () => {} },
  console, URL, Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, Promise,
  AbortController, Element: E, location: { protocol: "dsh-app:" },
  setTimeout: () => 0, clearTimeout: () => {},
  CustomEvent: class {}, fetch: async () => ({ ok: true, status: 200, text: async () => "{}" }),
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(SOURCE, sandbox, { filename: "client.js" });
const ex = factory((s) => (s === "react" ? { createElement: () => null, Fragment: "F", useState: (v) => [v, () => {}], useEffect: () => {}, useCallback: (f) => f, useMemo: (f) => f(), useRef: (v) => ({ current: v }) } : { createPortal: (n) => n }));

const t = ex.__test;
assert.ok(t && typeof t.speakerBlock === "function", "speakerBlock 未导出");
const NL = String.fromCharCode(10);

// 用户在 NOTE callout
const u = t.speakerBlock("用户", "帮我加一个功能");
console.log("=== 用户 ===");
console.log(u);
assert.ok(u.startsWith("> [!NOTE]"), "用户应使用 NOTE callout");
assert.ok(u.includes("👤"), "缺少用户图标");
assert.ok(u.includes("> 帮我加一个功能"), "内容应在 callout 内");

// 助手在 TIP callout
const a = t.speakerBlock("助手", "好的，我来实现。");
console.log("=== 助手 ===");
console.log(a);
assert.ok(a.startsWith("> [!TIP]"), "助手应使用 TIP callout");
assert.ok(a.includes("🤖"), "缺少助手图标");
assert.ok(a.includes("> 好的，我来实现。"), "内容应在 callout 内");

// 两者类型不同 = 颜色不同
assert.ok(u.includes("[!NOTE]") && !u.includes("[!TIP]"), "用户不应含 TIP");
assert.ok(a.includes("[!TIP]") && !a.includes("[!NOTE]"), "助手不应含 NOTE");

// 多行内容每行都要在 callout 内
const multi = t.speakerBlock("用户", "第一行" + NL + NL + "第二段" + NL + "第三行");
console.log("=== 多行用户 ===");
console.log(multi);
const quoteLines = multi.split(NL).filter((l) => l.startsWith(">"));
const contentLines = multi.split(NL).filter((l) => l.trim() !== "");
assert.equal(quoteLines.length, contentLines.length, "所有非空行都必须带 > 前缀，否则会甩出 callout");

// 未知角色不包 callout
assert.equal(t.speakerBlock("", "纯文本"), "纯文本");

// 空内容
assert.equal(t.speakerBlock("用户", ""), "");

console.log("\n全部断言通过");
process.exit(0);
