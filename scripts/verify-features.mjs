import { mkdtempSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert";

const home = mkdtempSync(join(tmpdir(), "dsh-feat-"));
process.env.DSH_HOME = home;
mkdirSync(join(home, "plugin-data", "dsh-siyuan-sync"), { recursive: true });

const mod = await import("/Users/luctorf/Desktop/项目文件夹/测试/dsh-siyuan-sync/lib/index.js");
const routes = new Map();
mod.apply({
  logger: { info() {}, warn() {} },
  effect: (fn) => { fn(); return () => {}; },
  inject: (n, cb) => cb({ effect: (fn) => { fn(); return () => {}; }, webServer: { register: (r) => { routes.set(r.path, r.handler); return () => {}; } } }),
});

async function call(method, path, body) {
  const h = routes.get(path);
  assert.ok(h, "路由不存在: " + path);
  const req = { method, url: path, headers: {}, async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(JSON.stringify(body)); } };
  let out = "";
  await h(req, { writeHead() {}, end(t) { out = t; } });
  return JSON.parse(out);
}

// ---- 1. layout 默认值与持久化 ----
const cfg0 = await call("GET", "/plugins/dsh-siyuan-sync/config");
assert.equal(cfg0.layout.notebook, "deepseek对话");
assert.equal(cfg0.layout.dateFormat, "dash");
assert.ok(cfg0.defaults, "缺少 defaults");
console.log("1. 默认 layout OK");

const saved = await call("POST", "/plugins/dsh-siyuan-sync/config", {
  layout: { notebook: "学习", dateFormat: "cn", appendMode: "separate", headingLevel: 2 },
});
assert.equal(saved.layout.notebook, "学习");
assert.equal(saved.layout.dateFormat, "cn");
const cfg1 = await call("GET", "/plugins/dsh-siyuan-sync/config");
assert.equal(cfg1.layout.appendMode, "separate");
console.log("2. layout 持久化 OK");

// ---- 2. 非法值应被回落到默认 ----
await call("POST", "/plugins/dsh-siyuan-sync/config", { layout: { dateFormat: "bogus", headingLevel: 99 } });
const cfg2 = await call("GET", "/plugins/dsh-siyuan-sync/config");
assert.equal(cfg2.layout.dateFormat, "cn", "非法日期格式应保持原值");
assert.equal(cfg2.layout.headingLevel, 2, "非法标题级别应保持原值");
console.log("3. 非法值被忽略 OK");

// ---- 3. 队列 action 校验 ----
const bad = await call("POST", "/plugins/dsh-siyuan-sync/queue", { action: "nope" });
assert.equal(bad.ok, false);
const noId = await call("POST", "/plugins/dsh-siyuan-sync/queue", { action: "retry" });
assert.equal(noId.ok, false);
console.log("4. 队列参数校验 OK");

// ---- 4. 手动塞一条队列，验证列表与删除 ----
const queueDir = join(home, "plugin-data", "dsh-siyuan-sync", "queue");
mkdirSync(queueDir, { recursive: true });
const entry = {
  id: "test-entry-1",
  createdAt: new Date().toISOString(),
  attempts: 2,
  notebook: "",
  folder: "",
  title: "2026-10-20",
  docTitle: "",
  markdown: "测试内容",
  meta: null,
  lastError: "offline",
};
const { writeFileSync } = await import("node:fs");
writeFileSync(join(queueDir, "test-entry-1.json"), JSON.stringify(entry));

const list1 = await call("GET", "/plugins/dsh-siyuan-sync/queue");
assert.equal(list1.pending, 1, "队列应有 1 条");
assert.equal(list1.entries[0].id, "test-entry-1");
assert.equal(list1.entries[0].attempts, 2);
assert.equal(list1.entries[0].bytes, 4);
console.log("5. 队列列表 OK");

const removed = await call("POST", "/plugins/dsh-siyuan-sync/queue", { action: "remove", id: "test-entry-1" });
assert.equal(removed.ok, true);
assert.equal(removed.removed, true);
const list2 = await call("GET", "/plugins/dsh-siyuan-sync/queue");
assert.equal(list2.pending, 0, "删除后应为 0");
console.log("6. 队列删除 OK");

// ---- 5. 不存在的条目重试 ----
const miss = await call("POST", "/plugins/dsh-siyuan-sync/queue", { action: "retry", id: "no-such" });
assert.equal(miss.ok, false);
console.log("7. 不存在条目 OK");

console.log("\n全部断言通过");
process.exit(0);