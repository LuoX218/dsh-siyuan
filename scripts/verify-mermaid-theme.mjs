import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert";

import * as mod from "../lib/markdown.js";
const { composeSegment, withMermaidInit, mermaidInitOf, MERMAID_PRESETS } = mod;

const F = String.fromCharCode(96).repeat(3);
const NL = String.fromCharCode(10);
const block = [F + "mermaid", "flowchart TD", "    A --> B", F].join(NL);

// 1) 所有预设都必须注入（关键：auto 也要注入，才能修复夜间问题）
for (const key of ["auto", "light", "dark", "high"]) {
  const out = withMermaidInit(block, MERMAID_PRESETS[key]);
  assert.ok(out.includes("%%{init:"), key + " 应注入主题指令");
  assert.ok(out.includes('"theme": "base"'), key + " 应使用 base 主题");
  assert.ok(out.includes("flowchart TD"), key + " 内容不应丢失");
  console.log("1." + key + " 注入 OK");
}

// 2) 关键约束：不能有深色节点背景（这正是夜间看不见的原因）
for (const key of ["auto", "light", "dark", "high"]) {
  const s = MERMAID_PRESETS[key];
  assert.ok(!s.includes('"background":"#181818"'), key + " 不应有 mermaid 默认深背景");
  assert.ok(!/#181818/i.test(s), key + " 不应出现 #181818");
}
console.log("2. 无深色默认背景 OK");

// 3) auto 必须是透明底 + 中性色（适配任意主题）
const auto = MERMAID_PRESETS.auto;
assert.ok(auto.includes('"edgeLabelBackground":"transparent"'), "auto 标签背景应透明");
assert.ok(auto.includes('"primaryColor":"rgba'), "auto 节点填充应半透明");
console.log("3. auto 自适应配色 OK");

// 4) 已有 init 不重复
const hasInit = [F + "mermaid", '%%{init: {"theme":"dark"}}%%', "flowchart TD", F].join(NL);
assert.equal((withMermaidInit(hasInit, MERMAID_PRESETS.light).match(/%%\{init:/g) || []).length, 1);
console.log("4. 不重复注入 OK");

// 5) 非 mermaid 块不受影响
const js = [F + "javascript", "const x = 1;", F].join(NL);
assert.equal(withMermaidInit(js, MERMAID_PRESETS.dark), js);
console.log("5. 普通代码块不受影响 OK");

// 6) 主题解析
assert.equal(mermaidInitOf({ mermaidTheme: "dark" }), MERMAID_PRESETS.dark);
assert.equal(mermaidInitOf({ mermaidTheme: "bogus" }), MERMAID_PRESETS.auto);
assert.equal(mermaidInitOf({}), MERMAID_PRESETS.auto);
console.log("6. 主题解析 OK");

// 7) 端到端
const md = ["### 图", "", block, "", "正文。"].join(NL);
const out = composeSegment(md, new Date("2026-10-20T01:00:00"), { headingLevel: 3, timeLabel: true, separator: true, mermaidTheme: "auto" });
assert.ok(out.includes("%%{init:"), "composeSegment 未注入");
assert.ok(out.includes("transparent"), "应含透明背景");
console.log("7. composeSegment OK");

console.log("\n全部断言通过");
process.exit(0);
