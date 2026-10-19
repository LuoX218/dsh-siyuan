import { readFileSync } from "node:fs";
import assert from "node:assert";

const SRC = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

// 1) 复制项必须存在，且在同步项之前
const copyIdx = SRC.indexOf('children: "复制"');
const syncIdx = SRC.indexOf('children: "同步这条消息到思源"');
const turnIdx = SRC.indexOf('children: "同步本轮对话"');
const winIdx = SRC.indexOf('children: "同步整个窗口的全部对话"');
const setIdx = SRC.indexOf('children: "思源笔记设置…"');

console.log("菜单项位置：");
console.log("  复制        ", copyIdx);
console.log("  同步这条消息 ", syncIdx);
console.log("  同步本轮    ", turnIdx);
console.log("  同步整窗口  ", winIdx);
console.log("  设置        ", setIdx);

assert.ok(copyIdx > 0, "缺少「复制」菜单项");
assert.ok(syncIdx > 0, "缺少「同步这条消息」");
assert.ok(copyIdx < syncIdx, "「复制」必须在「同步这条消息」之前");
assert.ok(syncIdx < turnIdx, "同步项顺序：单条 → 本轮");
assert.ok(turnIdx < winIdx, "同步项顺序：本轮 → 整窗口");
assert.ok(winIdx < setIdx, "设置项应最后");
console.log("1. 菜单顺序 OK：复制 → 单条 → 本轮 → 整窗口 → 设置");

// 2) copyRow 已实现并挂到 controller
assert.ok(/const copyRow = async \(row\)/.test(SRC), "copyRow 未定义");
assert.ok(/copyRow: copyRow/.test(SRC), "copyRow 未挂到 controller");
console.log("2. copyRow 已定义并暴露 OK");

// 3) 复制实现要包含 clipboard 与回退
assert.ok(SRC.includes("navigator.clipboard.writeText"), "缺少 clipboard API");
assert.ok(SRC.includes("execCommand"), "缺少 execCommand 回退");
assert.ok(SRC.includes("已复制到剪贴板"), "缺少成功提示");
console.log("3. 复制实现含 API + 回退 OK");

// 4) 复制用的是纯文本序列化（不带角色气泡标记）
const copyFn = SRC.slice(SRC.indexOf("const copyRow = async"), SRC.indexOf("const syncRow = (row)"));
assert.ok(copyFn.includes("serializeRow(row)"), "复制应使用 serializeRow");
assert.ok(!copyFn.includes("speakerBlock"), "复制不应加角色气泡（否则粘贴出来带 callout 标记）");
console.log("4. 复制取纯文本 OK");

console.log("\n全部断言通过");
process.exit(0);
