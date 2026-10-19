import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert";

// 拆分后：纯函数在 markdown.js，队列工具在 index.js
import * as mdmod from "../lib/markdown.js";
const { composeSegment, detectTags, buildSourceLine, fingerprint } = mdmod;

// 直接把 index.js 旁边生成一个临时副本，保证相对导入仍能解析
const idxUrl = new URL("../lib/index.js", import.meta.url);
const idxPath = fileURLToPath(idxUrl);
const IDX = readFileSync(idxPath, "utf8");
const patched = IDX.replace(
  /export const name = "dsh-siyuan-sync";/,
  "export const __q = { backoffDelay, classifyFailure };\nexport const name = \"dsh-siyuan-sync\";"
);
const tmp = join(dirname(idxPath), "__tmp_features_" + Date.now() + ".mjs");
writeFileSync(tmp, patched);
const mod = await import(pathToFileURL(tmp).href);
const { backoffDelay, classifyFailure } = mod.__q;

const NL = String.fromCharCode(10);
const D = new Date("2026-10-20T01:35:00");

// ============ 1. 回链 ============
const line = buildSourceLine({ syncKind: "本轮对话", sessionId: "abcdef1234567890", turn: 3 }, D);
console.log("回链:", line);
assert.ok(line.startsWith("> 来源：DeepSeek Harness"), "回链前缀不对");
assert.ok(line.includes("本轮对话"), "缺少类型");
assert.ok(line.includes("abcdef12"), "缺少会话 ID");
assert.ok(line.includes("第 3 轮"), "缺少轮次");
assert.ok(line.includes("2026-10-20"), "缺少日期");

// 可关闭
assert.equal(buildSourceLine({ sourceLine: false }, D), "", "sourceLine:false 应不生成");
console.log("1. 回链 OK");

// ============ 2. 指纹（重复检测） ============
const f1 = fingerprint("这是一段测试内容");
const f2 = fingerprint("这是一段测试内容");
const f3 = fingerprint("这是 一段 测试内容");   // 空白不同
const f4 = fingerprint("完全不同的内容");
assert.equal(f1, f2, "相同内容指纹应一致");
assert.equal(f1, f3, "空白差异不应影响指纹");
assert.notEqual(f1, f4, "不同内容指纹应不同");
assert.ok(f1.startsWith("dsh"), "指纹应带前缀");
console.log("2. 指纹 OK （" + f1 + "）");

// ============ 3. 失败归类 + 退避 ============
assert.equal(classifyFailure("fetch failed"), "offline");
assert.equal(classifyFailure("offline"), "offline");
assert.equal(classifyFailure("http 401"), "auth");
assert.equal(classifyFailure("token invalid"), "auth");
assert.equal(classifyFailure("parent block not found"), "missing");
assert.equal(classifyFailure("something weird"), "other");
console.log("3. 失败归类 OK");

const d1 = backoffDelay(1), d2 = backoffDelay(2), d3 = backoffDelay(3), d9 = backoffDelay(9);
console.log("   退避序列:", d1 / 1000 + "s", d2 / 1000 + "s", d3 / 1000 + "s", "封顶", d9 / 1000 + "s");
assert.ok(d1 < d2 && d2 < d3, "退避应递增");
assert.equal(d9, 300000, "应封顶 5 分钟");
console.log("   退避 OK");

// ============ 4. 自动标签 ============
const rules = [["方案|设计|架构", "方案设计"], ["报错|bug|error", "问题排查"], ["测试|验证", "测试验证"]];
const tags1 = detectTags("我来设计一下这个架构方案", rules);
const tags2 = detectTags("这里有个 bug 需要排查", rules);
const tags3 = detectTags("今天天气不错", rules);
console.log("   标签命中:", JSON.stringify(tags1), JSON.stringify(tags2), JSON.stringify(tags3));
assert.ok(tags1.includes("方案设计"), "应命中方案设计");
assert.ok(tags2.includes("问题排查"), "应命中问题排查");
assert.equal(tags3.length, 0, "无关内容不应命中");
// 非法正则不应崩溃
assert.deepEqual(detectTags("测试", [["[invalid", "x"]]), []);
console.log("4. 自动标签 OK");

// ============ 5. 端到端 composeSegment ============
const md = ["## 改造方案", "", "这是一段说明。", "", "- 列表项"].join(NL);
const out = composeSegment(md, D, { headingLevel: 3, timeLabel: true, separator: true, autoTags: rules, tagging: true }, { syncKind: "本轮对话", sessionId: "sess12345678", turn: 1 });
console.log("=== composeSegment 输出 ===");
console.log(out);
assert.ok(out.includes("### 01:35:00"), "缺少时间标题");
assert.ok(out.includes("#方案设计#"), "缺少自动标签");
assert.ok(out.includes("> 来源："), "缺少回链");
assert.ok(out.includes("## 改造方案"), "正文丢失");
assert.ok(out.includes("---"), "缺少分隔线");

// 关闭标签
const out2 = composeSegment(md, D, { headingLevel: 3, timeLabel: true, separator: true, autoTags: rules, tagging: false }, {});
assert.ok(!out2.includes("#方案设计#"), "关闭后不应有标签");

console.log("5. 端到端 OK");
console.log("\n全部断言通过");
try { unlinkSync(tmp); } catch { /* 清理失败不影响测试结果 */ }
process.exit(0);
