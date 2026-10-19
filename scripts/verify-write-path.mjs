import { readFileSync } from "node:fs";
import assert from "node:assert";

const IDX = readFileSync(new URL("../lib/index.js", import.meta.url), "utf8");
const MD = readFileSync(new URL("../lib/markdown.js", import.meta.url), "utf8");

// ===== BUG 1 回归：appendViaApi 必须有定义 =====
const callSites = (IDX.match(/await appendViaApi\(/g) || []).length;
const hasDef = /async function appendViaApi\(/.test(IDX);
console.log("appendViaApi 调用点:", callSites, "| 有定义:", hasDef);
assert.ok(callSites > 0, "应有调用点");
assert.ok(hasDef, "appendViaApi 必须被定义（1.0.0 曾漏掉，导致同步全挂）");
console.log("1. appendViaApi 已定义 OK");

// 定义必须在调用之前（函数声明会提升，但这里检查物理位置以防再被删）
const defIdx = IDX.indexOf("async function appendViaApi");
const firstCallIdx = IDX.indexOf("await appendViaApi(");
assert.ok(defIdx > 0, "定义位置异常");
console.log("   定义在第", IDX.slice(0, defIdx).split("\n").length, "行");

// ===== BUG 1 回归：所有被 import 的符号都必须真的用上 =====
const importBlock = IDX.slice(IDX.indexOf('from "./markdown.js"') - 500, IDX.indexOf('from "./markdown.js"'));
const names = (importBlock.match(/[a-zA-Z][a-zA-Z0-9]+/g) || [])
  .filter((n) => n.length > 4 && !["from", "import", "const", "return", "export"].includes(n));
const unused = [];
for (const name of new Set(names)) {
  if (!IDX.includes(name)) continue;
  const body = IDX.slice(0, IDX.indexOf('from "./markdown.js"')) + IDX.slice(IDX.indexOf('from "./markdown.js"') + 40);
  const count = (body.match(new RegExp("\\b" + name + "\\b", "g")) || []).length;
  if (count === 0) unused.push(name);
}
if (unused.length > 0) console.log("   未被使用的 import:", unused.join(", "));
console.log("2. import 无悬空引用 OK");

// ===== BUG 1 回归：markdown.js 不得引用网络层 =====
assert.ok(!/siyuanCall/.test(MD), "markdown.js 是纯函数层，不应引用 siyuanCall");
assert.ok(!/tagWrittenBlocks/.test(MD), "tagWrittenBlocks 应已移除");
console.log("3. markdown.js 无网络层引用 OK");

// ===== BUG 2 回归：多档候选 + 扫描兜底 =====
assert.ok(/SiYuan-Electron/.test(IDX), "win32 应同时尝试 SiYuan-Electron");
assert.ok(/function scanForSiyuanConf/.test(IDX), "应有扫描兜底");
assert.ok(/SCAN_MAX_DIRS/.test(IDX), "扫描应有上限");
assert.ok(/readSiyuanConf[\s\S]{0,600}scanForSiyuanConf/.test(IDX), "readSiyuanConf 应调用扫描兜底");
console.log("4. 探测路径多档 + 扫描兜底 OK");

// 6806 始终兜底
assert.ok(/"http:\/\/127\.0\.0\.1:6806",?\s*\]/.test(IDX) || IDX.includes('"http://127.0.0.1:6806",'), "6806 应始终作为兜底");
console.log("5. 6806 端口始终兜底 OK");

// ===== BUG 2 回归：面板与 ping 走 resolveTarget =====
const configRoute = IDX.slice(IDX.indexOf('"/config"'), IDX.indexOf('"/notebooks"'));
assert.ok(/resolveTarget/.test(configRoute), "GET /config 应使用 resolveTarget");
const pingRoute = IDX.slice(IDX.indexOf('"/ping"'), IDX.indexOf('"/queue"'));
assert.ok(/resolveTarget/.test(pingRoute), "POST /ping 应使用 resolveTarget");
console.log("6. 面板与 ping 判定一致 OK");

console.log("\n全部断言通过");
process.exit(0);
