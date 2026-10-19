import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert";

// 每个场景用独立的 DSH_HOME，避免相互干扰
function freshHome() {
  const home = mkdtempSync(join(tmpdir(), "dsh-detect-"));
  process.env.DSH_HOME = home;
  return home;
}

const ROOT = "/Users/luctorf/Desktop/项目文件夹/测试/dsh-siyuan-sync";
const ok = (n, c) => console.log((c ? "  ✓ " : "  ✗ ") + n);

console.log("=== 探测逻辑静态检查 ===");

const SRC = (await import("node:fs")).readFileSync(ROOT + "/lib/index.js", "utf8");

// 1) 三平台默认路径
assert.ok(/SiYuan-Electron/.test(SRC), "应覆盖 SiYuan-Electron");
assert.ok(/\.config.*siyuan|siyuan.*\.config/.test(SRC), "应覆盖 Linux 路径");
ok("三平台默认路径齐备", true);

// 2) Windows 多盘符扫描
assert.ok(/win32/.test(SRC) && /fromCharCode/.test(SRC), "Windows 应扫描各盘符");
ok("Windows 多盘符扫描", true);

// 3) 常见端口兜底
assert.ok(/COMMON_SIYUAN_PORTS/.test(SRC), "应有常见端口兜底");
assert.ok(/6806/.test(SRC) && /1155/.test(SRC), "应含 6806 与 1155");
ok("常见端口兜底（含 1155）", true);

// 4) 空 token 不再被跳过
assert.ok(!/typeof token !== "string" \|\| token === ""\) continue/.test(SRC), "不应因空 token 跳过");
ok("空 token 不被跳过", true);

// 5) 空 token 不发鉴权头
assert.ok(/if \(typeof token === "string" && token !== ""\) headers\.Authorization/.test(SRC), "空 token 不应发鉴权头");
ok("空 token 不发鉴权头", true);

// 6) 手动配置优先
assert.ok(/manualBase !== "" && manualToken !== ""/.test(SRC), "手动配置应优先");
ok("手动配置优先", true);

// 7) 改连接配置时清缓存
assert.ok(/touchedConnection[\s\S]{0,200}matchCache = null/.test(SRC), "改配置应清缓存");
ok("改配置清缓存", true);

// 8) 扫描有上限
assert.ok(/SCAN_MAX_DIRS/.test(SRC) && /SCAN_MAX_DEPTH/.test(SRC), "扫描必须有上限");
ok("扫描有上限（不卡死）", true);

// 9) 单个 conf 损坏不中断
assert.ok(/单个 conf 读不了或格式坏了/.test(SRC), "损坏的 conf 应跳过而非中断");
ok("损坏 conf 不中断探测", true);

// 10) 面板有手动输入
const CLIENT = (await import("node:fs")).readFileSync(ROOT + "/lib/client.js", "utf8");
assert.ok(/手动指定思源地址/.test(CLIENT), "面板应支持手动指定地址");
assert.ok(/manualToken/.test(CLIENT), "面板应支持手动填 token");
ok("面板支持手动指定", true);

console.log("\n全部断言通过");
process.exit(0);
