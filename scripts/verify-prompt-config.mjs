import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert";

const home = mkdtempSync(join(tmpdir(), "dsh-prompt-"));
process.env.DSH_HOME = home;
mkdirSync(join(home, "plugin-data", "dsh-siyuan-sync"), { recursive: true });

const mod = await import("/Users/luctorf/Desktop/项目文件夹/测试/dsh-siyuan-sync/lib/index.js");
const routes = new Map();
mod.apply({
  logger: { info(){}, warn(){} },
  effect: (fn) => { fn(); return () => {}; },
  inject: (n, cb) => cb({
    effect: (fn) => { fn(); return () => {}; },
    webServer: { register: (r) => { routes.set(r.path, r.handler ?? r.handle ?? r.fn); return () => {}; } },
  }),
});

async function call(method, path, body) {
  const h = routes.get(path);
  assert.ok(h, "缺少路由 " + path);
  const req = {
    method, url: path, headers: {},
    async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(JSON.stringify(body)); },
  };
  let out = "";
  await h(req, { writeHead(){}, end(t){ out = t; } });
  return JSON.parse(out);
}

// 1) 默认值为空字符串
const c1 = await call("GET", "/plugins/dsh-siyuan-sync/config", undefined);
console.log("默认 summaryPrompt:", JSON.stringify(c1.config?.summaryPrompt));
assert.equal(c1.config?.summaryPrompt, "", "默认应为空字符串");

// 2) 保存自定义提示词
const custom = "请按我的格式总结：1) 结论 2) 依据";
await call("POST", "/plugins/dsh-siyuan-sync/config", { summaryPrompt: custom });

// 3) 回读能拿到
const c2 = await call("GET", "/plugins/dsh-siyuan-sync/config", undefined);
console.log("回读 summaryPrompt:", JSON.stringify(c2.config?.summaryPrompt));
assert.equal(c2.config?.summaryPrompt, custom, "回读应一致");

// 4) 落盘检查
const saved = JSON.parse(readFileSync(join(home, "plugin-data", "dsh-siyuan-sync", "config.json"), "utf8"));
assert.equal(saved.summaryPrompt, custom, "应写入磁盘");

// 5) 其它配置项不受影响
assert.ok(c2.layout !== undefined, "layout 应仍存在");

// 6) 传空字符串可以清空
await call("POST", "/plugins/dsh-siyuan-sync/config", { summaryPrompt: "" });
const c3 = await call("GET", "/plugins/dsh-siyuan-sync/config", undefined);
assert.equal(c3.config?.summaryPrompt, "", "应能清空");

console.log("\n全部断言通过");
process.exit(0);
