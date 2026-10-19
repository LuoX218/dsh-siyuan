/**
 * dsh-siyuan-sync — Host half.
 *
 * 把 DSH 对话内容同步到思源笔记（SiYuan）。
 *
 * 设计约束（稳定优先）：
 * 1. 所有外部依赖都用 node: 内置模块；不 import 任何 @deepseek-ai/* 包，
 *    避免 profile 依赖解析失败把整棵插件树拖挂。
 * 2. 路由全部挂在唯一前缀 /plugins/dsh-siyuan-sync/ 下，不会与任何现有插件
 *    冲突（webServer.register 对重复 (kind,path) 会 throw，进而让 fiber 失败）。
 * 3. apply() 内部整体 try/catch：任何异常只记日志，不再抛出。
 * 4. 配置写在 $DSH_HOME/plugin-data/dsh-siyuan-sync/config.json，与 profile 分离。
 */

// 只用文件系统管理插件自己的配置与队列（$DSH_HOME 下）。
// 思源的 data 目录一律不碰，全部走内核 API。
import { readFile, writeFile, mkdir, stat, readdir, unlink, rename } from "node:fs/promises";

// 本插件自己的模块（纯函数，便于单独测试）
import { dayKey, dayStamp, renderTitle, fullStamp } from "./time.js";
import {
  composeSegment, mermaidInitOf, withMermaidInit, fingerprint, isMissingParent,
  detectTags, buildSourceLine, MERMAID_PRESETS, MERMAID_THEME_VARS,
  buildMermaidInit, splitBlocks, isDiagramLang, DIAGRAM_LANGS,
  // 供测试使用的再导出
} from "./markdown.js";

// 只读思源的 conf.json（获取 API token），绝不读写 data 目录。
import { readFileSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";

const ROUTE_PREFIX = "/plugins/dsh-siyuan-sync";
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 4 * 1024 * 1024;

// ---------------------------------------------------------------------------
// 存储位置
// ---------------------------------------------------------------------------

function dshHome() {
  const fromEnv = process.env.DSH_HOME;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") return fromEnv.trim();
  return join(homedir(), ".dsh");
}

function pluginDataDir() {
  return join(dshHome(), "plugin-data", "dsh-siyuan-sync");
}

function configPath() {
  return join(pluginDataDir(), "config.json");
}

/** 待写入队列：每条一个 JSON 文件，思源没开时先落盘，开了再补写。 */
function queueDir() {
  return join(pluginDataDir(), "queue");
}

/** 配置默认值（只列有意义的默认，其余按需写入）。 */
const CONFIG_DEFAULTS = {
  // 摘要提示词，留空 = 使用内置模板 DEFAULT_SUMMARY_PROMPT
  summaryPrompt: "",
};

async function readConfig() {
  try {
    const text = await readFile(configPath(), "utf8");
    const parsed = JSON.parse(text);
    const base = parsed !== null && typeof parsed === "object" ? parsed : {};
    return Object.assign({}, CONFIG_DEFAULTS, base);
  } catch {
    return Object.assign({}, CONFIG_DEFAULTS);
  }
}

async function writeConfig(next) {
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

// ---------------------------------------------------------------------------
// 思源自动探测：本机 conf.json 里有 api.token 和监听端口
// ---------------------------------------------------------------------------

function siyuanConfCandidates() {
  const home = homedir();
  const out = [];
  if (platform() === "darwin") {
    out.push(join(home, "Library", "Application Support", "SiYuan", "conf", "conf.json"));
    out.push(join(home, "Library", "Application Support", "SiYuan-Electron", "conf", "conf.json"));
  } else if (platform() === "win32") {
    out.push(join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "SiYuan", "conf", "conf.json"));
  } else {
    out.push(join(home, ".config", "siyuan", "conf.json"));
  }
  // 用户自定工作空间：只作为「优先尝试」，默认路径始终保留在后面兜底。
  // 如果自定义路径失效（目录被删、换了工作空间），不能因此彻底连不上思源。
  const ws = process.env.SIYUAN_WORKSPACE;
  if (typeof ws === "string" && ws.trim() !== "") out.unshift(join(ws, "conf", "conf.json"));
  return out;
}

/**
 * 读本机思源配置：token + 候选地址列表（按「本机优先」排序）。
 *
 * 关键修复：之前只取 serverAddrs 第一项，而思源会把自己的局域网地址排在
 * 前面（例如 192.168.5.25），于是明明本机开着也连不上。现在本机回环地址
 * 永远排在最前，其余地址作为兜底。
 */
const LOOPBACK_PATTERN = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;

function readSiyuanConf() {
  const found = [];
  for (const candidate of siyuanConfCandidates()) {
    let conf;
    try {
      if (!statSync(candidate).isFile()) continue;
      conf = JSON.parse(readFileSync(candidate, "utf8"));
    } catch {
      continue;
    }
    const token = conf?.api?.token;
    if (typeof token !== "string" || token === "") continue;

    const addrs = Array.isArray(conf?.serverAddrs) ? conf.serverAddrs : [];
    const normalized = [];
    for (const entry of addrs) {
      const raw = typeof entry === "string" ? entry : entry?.addr;
      if (typeof raw !== "string" || raw.trim() === "") continue;
      const withScheme = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : "http://" + raw.trim();
      const clean = withScheme.replace(/\/+$/, "");
      if (!normalized.includes(clean)) normalized.push(clean);
    }
    // 本机回环优先；配置里没写本机地址时才补 6806 兜底。
    const loopback = normalized.filter((addr) => LOOPBACK_PATTERN.test(addr));
    const remote = normalized.filter((addr) => !LOOPBACK_PATTERN.test(addr));
    const candidates = [
      ...loopback,
      ...remote,
      ...(loopback.length === 0 ? ["http://127.0.0.1:6806"] : []),
    ].filter((addr, index, all) => all.indexOf(addr) === index);

    found.push({ token, candidates, source: candidate });
  }
  return found;
}

/** 旧接口：只做静态读取（不联网），用于快速回显。 */
async function detectSiyuan() {
  const confs = readSiyuanConf();
  if (confs.length === 0) return { ok: false };
  const [first] = confs;
  return { ok: true, token: first.token, baseUrl: first.candidates[0] ?? "http://127.0.0.1:6806", source: first.source };
}

/** 对单个地址做一次真实鉴权探测，成功才算「匹配上」。 */
async function probeEndpoint(baseUrl, token) {
  const result = await siyuanCall(baseUrl, token, "/api/system/version", {}, 2500);
  if (!result.ok) return null;
  return { baseUrl, version: String(result.data ?? "") };
}

/**
 * 自动匹配正在运行的思源：并发探测所有候选地址，取第一个鉴权通过的。
 * 结果按 token 缓存一小段时间，避免每次打开面板都重新扫。
 */
let matchCache = null;
const MATCH_TTL_MS = 15000;

async function autoMatchSiyuan(force) {
  const now = Date.now();
  if (!force && matchCache !== null && now - matchCache.at < MATCH_TTL_MS) return matchCache.value;

  const confs = readSiyuanConf();
  if (confs.length === 0) {
    const value = { ok: false, reason: "no-conf" };
    matchCache = { at: now, value };
    return value;
  }

  for (const conf of confs) {
    const settled = await Promise.allSettled(
      conf.candidates.map((baseUrl) => probeEndpoint(baseUrl, conf.token))
    );
    for (const entry of settled) {
      if (entry.status === "fulfilled" && entry.value !== null) {
        const value = {
          ok: true,
          token: conf.token,
          baseUrl: entry.value.baseUrl,
          version: entry.value.version,
          source: conf.source,
          tried: conf.candidates,
        };
        matchCache = { at: now, value };
        return value;
      }
    }
  }

  const value = { ok: false, reason: "unreachable", tried: confs[0].candidates };
  matchCache = { at: now, value };
  return value;
}

/** 解析真正要用的地址与 token：手动配置优先，否则自动匹配。 */
async function resolveTarget(config) {
  const manualBase = typeof config?.baseUrl === "string" ? config.baseUrl.trim().replace(/\/+$/, "") : "";
  const manualToken = typeof config?.token === "string" ? config.token.trim() : "";

  if (manualBase !== "" && manualToken !== "") {
    return { baseUrl: manualBase, token: manualToken, detected: true, manual: true };
  }

  const matched = await autoMatchSiyuan(false);
  if (matched.ok) {
    return {
      baseUrl: manualBase !== "" ? manualBase : matched.baseUrl,
      token: manualToken !== "" ? manualToken : matched.token,
      detected: true,
      manual: false,
      version: matched.version,
      source: matched.source,
    };
  }

  // 匹配失败时仍回退到静态读取结果，让报错信息更有指向性。
  const fallback = await detectSiyuan();
  return {
    baseUrl: manualBase !== "" ? manualBase : (fallback.baseUrl ?? "http://127.0.0.1:6806"),
    token: manualToken !== "" ? manualToken : (fallback.token ?? ""),
    detected: false,
    manual: false,
    reason: matched.reason,
    tried: matched.tried,
  };
}

// ---------------------------------------------------------------------------
// 思源 API 客户端
// ---------------------------------------------------------------------------

async function siyuanCall(baseUrl, token, apiPath, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(new URL(apiPath, baseUrl.replace(/\/+$/, "") + "/"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Token " + token,
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = undefined; }
    if (!res.ok) {
      return { ok: false, status: res.status, error: "http " + res.status, raw: text.slice(0, 400) };
    }
    if (json === undefined) return { ok: false, status: res.status, error: "non-json response", raw: text.slice(0, 400) };
    if (json.code !== 0) return { ok: false, status: res.status, error: String(json.msg ?? "siyuan error"), code: json.code };
    return { ok: true, data: json.data };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : String(error?.message ?? error);
    return { ok: false, error: reason };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// HTTP 帮助函数
// ---------------------------------------------------------------------------

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function loopbackOrigin(req) {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error("payload too large");
    chunks.push(chunk);
  }
  if (total === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  const parsed = JSON.parse(text);
  return parsed !== null && typeof parsed === "object" ? parsed : {};
}

// ---------------------------------------------------------------------------
// 文档路径与标题
// ---------------------------------------------------------------------------
// 写入：只走内核 API 与「离线队列」
// ---------------------------------------------------------------------------
//
// 思源明确要求：外部程序不要直接读写 <workspace>/data 下的文件，
// 否则云同步分块可能丢失、云端数据损坏（见官方 Issue #9807 相关说明）。
//
// 所以：
//   思源在运行 → 全部通过 /api/... 写入（appendBlock / createDocWithMd 等）
//   思源没运行 → 内容存进插件自己的队列（$DSH_HOME 下），它启动后补写
// 插件唯一读取思源目录的是 conf/conf.json（拿 API token），只读不写。

const DEFAULT_NOTEBOOK_NAME = "deepseek对话";
const DAILY_NOTE_PREFIX = "custom-dailynote-";

/**
 * 存放规则的默认值。用户可在设置面板里覆盖，覆盖项写进 config.json。
 *
 *   notebook    目标笔记本名（找不到会自动创建）
 *   groupByDay  是否按日期归类
 *   dateFormat  日期格式：dash / slash / cn
 *   appendMode  same（同日追加到一篇）/ separate（每条独立文档）
 *   titleTemplate 独立文档模式下的标题模板，支持 {date} {time} {title}
 *   headingLevel 每段开头时间戳标题的级别（0 = 不要标题）
 */
const DEFAULT_LAYOUT = {
  notebook: DEFAULT_NOTEBOOK_NAME,
  groupByDay: true,
  dateFormat: "dash",
  appendMode: "same",
  titleTemplate: "{date} {time}",
  headingLevel: 3,
  // 多段之间是否插入分隔线，视觉上区分每次同步
  separator: true,
  // 段首时间戳是否显示（与 headingLevel 配合）
  timeLabel: true,
  // mermaid 图表主题：auto 跟随思源 / light / dark / high
  mermaidTheme: "auto",
  // 自动标签开关
  tagging: true,
  // 标签规则：[正则, 标签名][]
  autoTags: [
    ["方案|设计|架构|重构", "方案设计"],
    ["报错|错误|异常|bug|error|崩溃", "问题排查"],
    ["测试|验证|用例", "测试验证"],
    ["配置|设置|参数", "配置说明"],
    ["部署|发布|上线", "部署发布"],
  ],
};

/** 把配置里的 layout 与默认值合并，并做类型校正。 */
function resolveLayout(config) {
  const raw = config?.layout;
  const source = raw !== null && typeof raw === "object" ? raw : {};
  const merged = { ...DEFAULT_LAYOUT };

  if (typeof source.notebook === "string" && source.notebook.trim() !== "") {
    merged.notebook = source.notebook.trim();
  }
  if (typeof source.groupByDay === "boolean") merged.groupByDay = source.groupByDay;
  if (source.dateFormat === "dash" || source.dateFormat === "slash" || source.dateFormat === "cn") {
    merged.dateFormat = source.dateFormat;
  }
  if (source.appendMode === "same" || source.appendMode === "separate") {
    merged.appendMode = source.appendMode;
  }
  if (typeof source.titleTemplate === "string" && source.titleTemplate.trim() !== "") {
    merged.titleTemplate = source.titleTemplate.trim();
  }
  if (Number.isInteger(source.headingLevel) && source.headingLevel >= 0 && source.headingLevel <= 6) {
    merged.headingLevel = source.headingLevel;
  }
  if (typeof source.separator === "boolean") merged.separator = source.separator;
  if (typeof source.timeLabel === "boolean") merged.timeLabel = source.timeLabel;
  if (["auto", "light", "dark", "high"].includes(source.mermaidTheme)) {
    merged.mermaidTheme = source.mermaidTheme;
  }
  if (typeof source.tagging === "boolean") merged.tagging = source.tagging;
  if (Array.isArray(source.autoTags)) {
    merged.autoTags = source.autoTags.filter((rule) => Array.isArray(rule) && rule.length >= 2);
  }
  return merged;
}

/** notebookId|标题 → 文档 ID，避免索引延迟导致同一天重复建篇。 */
const dailyDocCache = new Map();

/** 日期标签：20261019 */
/** 按名字找到笔记本；没有就建一个。 */
async function ensureNotebookViaApi(target, config, layout) {
  const call = (p, b) => siyuanCall(target.baseUrl, target.token, p, b, 10000);
  const wanted = layout?.notebook || DEFAULT_NOTEBOOK_NAME;

  const listed = await call("/api/notebook/lsNotebooks", {});
  if (!listed.ok) return { ok: false, error: isConnectFailure(listed.error) ? "connect" : listed.error };

  const notebooks = (listed.data?.notebooks ?? []).filter((nb) => nb && nb.closed !== true);

  // 配置里指定了 ID：只有名字也对得上才用，绝不占用用户自己的笔记本
  const configured = String(config?.notebook || "");
  if (configured !== "") {
    const hit = notebooks.find((nb) => String(nb.id) === configured);
    if (hit !== undefined && String(hit.name) === wanted) {
      return { ok: true, id: configured, name: String(hit.name) };
    }
  }

  const named = notebooks.find((nb) => String(nb.name) === wanted);
  if (named !== undefined) return { ok: true, id: String(named.id), name: String(named.name) };

  const created = await call("/api/notebook/createNotebook", { name: wanted });
  if (!created.ok) return { ok: false, error: created.error };
  const id = String(created.data?.notebook?.id ?? "");
  if (id === "") return { ok: false, error: "创建笔记本失败" };
  return { ok: true, id, name: wanted };
}

/**
 * 找到目标文档。
 *
 * 三种模式：
 *   groupByDay + appendMode=same       → 笔记本/日期（同一天一篇）
 *   groupByDay + appendMode=separate   → 按 titleTemplate 生成独立标题，放在笔记本根下
 *   !groupByDay                        → 同样走独立标题（不按日期归类）
 */
async function ensureTargetDocViaApi(target, config, date, extraTitle) {
  const call = (p, b) => siyuanCall(target.baseUrl, target.token, p, b, 12000);
  const layout = resolveLayout(config);

  const notebook = await ensureNotebookViaApi(target, config, layout);
  if (!notebook.ok) return { ok: false, error: notebook.error };
  const notebookId = notebook.id;

  // 判定「同一天一篇」还是「每条独立」
  const sameDoc = layout.groupByDay && layout.appendMode === "same";
  const title = sameDoc
    ? dayStamp(date, layout.dateFormat)
    : renderTitle(layout.titleTemplate, date, extraTitle);

  const cacheKey = notebookId + "|" + title;
  const cached = dailyDocCache.get(cacheKey);
  if (cached !== undefined) {
    return { ok: true, docId: cached, notebook: notebookId, title, sameDoc, layout, cacheKey };
  }

  const remember = (docId) => {
    // 独立文档不复用：每条都要新文档，避免内容堆在一起
    if (sameDoc) dailyDocCache.set(cacheKey, docId);
    return { ok: true, docId, notebook: notebookId, title, sameDoc, layout, cacheKey };
  };

  if (sameDoc) {
    // 查重三重保险：进程缓存 → SQL → 文件树
    const sql = await call("/api/query/sql", {
      stmt: "SELECT id FROM blocks WHERE type = 'd' AND box = '" + notebookId +
        "' AND content = '" + title + "' ORDER BY created ASC LIMIT 1",
    });
    if (sql.ok && Array.isArray(sql.data) && sql.data.length > 0) {
      const docId = String(sql.data[0].id ?? "");
      if (docId !== "") return remember(docId);
    }
    const listed = await call("/api/filetree/listDocsByPath", { notebook: notebookId, path: "/" });
    const files = listed.ok ? (listed.data?.files ?? []) : [];
    for (const file of files) {
      if (String(file?.name ?? "") === title && typeof file?.id === "string" && file.id !== "") {
        return remember(file.id);
      }
    }
  }

  const created = await call("/api/filetree/createDocWithMd", {
    notebook: notebookId,
    path: "/" + title,
    markdown: "",
  });
  if (!created.ok) {
    return { ok: false, error: isConnectFailure(created.error) ? "connect" : created.error };
  }
  const docId = String(created.data ?? "");
  if (docId === "") return { ok: false, error: "创建文档失败" };
  if (sameDoc) dailyDocCache.set(cacheKey, docId);

  // 手动创建时补日记属性，思源才会把它当日记看
  if (sameDoc && layout.groupByDay) {
    await call("/api/attr/setBlockAttrs", {
      id: docId,
      attrs: { [DAILY_NOTE_PREFIX + dayKey(date)]: docId },
    });
  }

  return { ok: true, docId, notebook: notebookId, title, sameDoc, layout, cacheKey };
}

/**
 * 把一段 Markdown 拆成「逻辑块」，逐块追加。
 *
 * 为什么要拆：
 *   1. appendBlock 一次塞大段 markdown 时，思源内部的解析会产生同序号的块，
 *      导致内容顺序不稳定（实测出现过标题跑到前面）。
 *   2. 逐块插入能让每个块精确落在它该在的位置，块之间也有正确间距。
 *
 * 拆分规则保持克制：只按「空行」切分，且保持列表/代码块内部的连续性。
 */
/** 思源会把这些语言的代码块渲染成图表，必须原样保留。 */
// ---------------------------------------------------------------------------
// 离线队列：思源没启动时先存下来
// ---------------------------------------------------------------------------
//
// 只存本地队列，不碰思源 data 目录。思源一启动就补写。
//

const MAX_QUEUE_ENTRIES = 500;
const MAX_ATTEMPTS = 8;

function queuePath(id) {
  return join(queueDir(), id + ".json");
}

async function ensureQueueDir() {
  await mkdir(queueDir(), { recursive: true });
}

function newEntryId() {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return stamp + "-" + rand;
}

async function enqueue(entry) {
  await ensureQueueDir();
  const id = entry.id ?? newEntryId();
  const record = {
    id,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    attempts: entry.attempts ?? 0,
    notebook: entry.notebook ?? "",
    folder: entry.folder ?? "",
    title: entry.title ?? "",
    // 独立文档模式下用的标题（可能带用户自定义前缀）
    docTitle: entry.docTitle ?? "",
    markdown: entry.markdown ?? "",
    meta: entry.meta ?? null,
    lastError: entry.lastError ?? null,
    // 失败归类与下次重试时间
    lastReason: entry.lastReason ?? null,
    nextAt: entry.nextAt ?? null,
    // 回链上下文
    syncKind: entry.syncKind ?? "",
    sessionId: entry.sessionId ?? "",
  };
  const path = queuePath(id);
  const tmp = path + ".tmp-" + process.pid;
  await writeFile(tmp, JSON.stringify(record, null, 2), "utf8");
  await rename(tmp, path);
  return record;
}

async function listQueue() {
  try {
    const names = await readdir(queueDir());
    const entries = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      try {
        const text = await readFile(queuePath(name.replace(/\.json$/, "")), "utf8");
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object" && typeof parsed.id === "string") entries.push(parsed);
      } catch {
        continue;
      }
    }
    entries.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    return entries;
  } catch {
    return [];
  }
}

async function removeEntry(id) {
  try {
    await unlink(queuePath(id));
    return true;
  } catch {
    return false;
  }
}

async function updateEntry(entry) {
  try {
    const path = queuePath(entry.id);
    const tmp = path + ".tmp-" + process.pid;
    await writeFile(tmp, JSON.stringify(entry, null, 2), "utf8");
    await rename(tmp, path);
  } catch {
    /* 更新失败不影响主流程 */
  }
}

function isConnectFailure(error) {
  const text = String(error ?? "");
  return /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|aborted|socket|network/i.test(text);
}

/** 把一条队列记录真正写进去（API 或文件，取决于当前可用性）。 */
async function flushEntry(entry) {
  const config = await readConfig();
  const date = new Date(entry.createdAt ?? Date.now());

  const target = await resolveTarget(config);
  if (target.token === "" || target.detected === false) {
    return { ok: false, deferred: true, error: "offline" };
  }

  // 与 syncDocument 一致：目标文档被删时清缓存重建一次
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const doc = await ensureTargetDocViaApi(target, config, date, entry.docTitle ?? "");
    if (!doc.ok) {
      return { ok: false, deferred: doc.error === "connect", error: doc.error };
    }

    const appended = await appendViaApi(target, doc.docId, String(entry.markdown ?? ""), date, doc.layout, doc.cacheKey, {
      syncKind: entry.syncKind ?? "队列补写",
      sessionId: entry.sessionId ?? "",
    });
    if (appended.ok) {
      return {
        ok: true,
        docId: doc.docId,
        path: "/" + doc.layout.notebook + "/" + doc.title,
        notebook: doc.notebook,
        mode: "api",
      };
    }

    if (appended.missingParent === true) continue;

    return { ok: false, deferred: isConnectFailure(appended.error), error: appended.error };
  }

  return { ok: false, deferred: false, error: "目标文档反复丢失，请检查思源笔记本" };
}

/** 补写串行化：同一时刻只跑一轮，避免并发重复写入。 */
let flushing = null;

/** 补写全部队列；返回处理结果，供 UI 与定时器使用。 */
/** 指数退避：30s → 1m → 2m → 5m，封顶 5 分钟。 */
function backoffDelay(attempts) {
  const steps = [30_000, 60_000, 120_000, 300_000];
  return steps[Math.min(Math.max(attempts - 1, 0), steps.length - 1)];
}

/**
 * 把失败原因归类，让用户一眼看懂该做什么。
 *   offline  思源没开 → 打开就行
 *   auth     凭据失效 → 检查设置
 *   missing  目标文档没了 → 会自动重建
 *   other    其他 → 看详细错误
 */
function classifyFailure(error) {
  const text = String(error ?? "");
  if (/offline|connect|fetch failed|ECONNREFUSED|timeout|aborted/i.test(text)) return "offline";
  if (/401|403|auth|token/i.test(text)) return "auth";
  if (/not found|missing/i.test(text)) return "missing";
  return "other";
}

async function flushQueue() {
  if (flushing !== null) return flushing;
  flushing = (async () => {
    const entries = await listQueue();
    if (entries.length === 0) return { ok: true, flushed: 0, remaining: 0, failed: [] };

    let flushed = 0;
    const failed = [];
    let stopped = false;

    for (const entry of entries) {
      if (stopped) break;
      const result = await flushEntry(entry);
      if (result.ok) {
        await removeEntry(entry.id);
        flushed += 1;
        continue;
      }
      if (result.deferred === true) {
        // 思源还没起：保留全部队列，下一轮再来。
        stopped = true;
        break;
      }
      const attempts = Number(entry.attempts ?? 0) + 1;
      // 退避：连续失败越多次，下次重试间隔越长
      const nextAt = new Date(Date.now() + backoffDelay(attempts)).toISOString();
      const reason = classifyFailure(result.error);

      if (attempts >= MAX_ATTEMPTS) {
        await updateEntry({ ...entry, attempts, lastError: result.error, lastReason: reason, nextAt });
        failed.push({ id: entry.id, title: entry.title, error: result.error, reason, attempts });
        continue;
      }
      await updateEntry({ ...entry, attempts, lastError: result.error, lastReason: reason, nextAt });
    }

    const remaining = (await listQueue()).length;
    return { ok: true, flushed, remaining, failed };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

// ---------------------------------------------------------------------------
// 同步主体
// ---------------------------------------------------------------------------

async function listNotebooks(config, force) {
  if (force === true) matchCache = null;
  const target = await resolveTarget(config);
  if (target.token === "") {
    return {
      ok: false,
      error: target.reason === "no-conf"
        ? "没有找到本机思源配置（请先打开思源）"
        : "无法连接本机思源（请确认思源已打开且 API 已启用）",
      detected: target.detected,
    };
  }
  const result = await siyuanCall(target.baseUrl, target.token, "/api/notebook/lsNotebooks", {}, 5000);
  if (!result.ok) {
    return {
      ok: false,
      error: "连接思源失败：" + result.error,
      baseUrl: target.baseUrl,
      detected: target.detected,
    };
  }
  const notebooks = (result.data?.notebooks ?? [])
    .filter((nb) => nb && nb.closed !== true)
    .map((nb) => ({ id: String(nb.id), name: String(nb.name ?? nb.id) }));
  return {
    ok: true,
    baseUrl: target.baseUrl,
    version: target.version,
    notebooks,
  };
}

/**
 * 同步一条内容：只走内核 API（符合思源对外部程序的要求）。
 *
 *   思源在运行 → 写入当天日记文档，立刻可见
 *   思源没运行 → 落本地队列，下次它启动后自动补写
 *
 * 存放：deepseek对话（笔记本） / 2026-10-19（当天日记）
 * 每段以 "### HH:mm:ss" 开头，同一天追加到同一篇。
 */
async function syncDocument(payload, config) {
  const markdown = String(payload?.markdown ?? "");
  if (markdown.trim() === "") return { ok: false, error: "内容为空，没有可同步的文本" };

  const now = new Date();
  const layout = resolveLayout(config);
  // 独立文档模式下用用户给的标题参与命名；同一篇模式下忽略
  const extraTitle = typeof payload?.docTitle === "string" ? payload.docTitle.trim() : "";

  // 写入只能走内核 API。内核不在就如实告知，不假装成功、不去拉起它。
  const target = await resolveTarget(config);
  const apiUsable = target.token !== "" && target.detected !== false;

  if (apiUsable) {
    // 最多尝试两轮：文档被删时清缓存重建一次
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const doc = await ensureTargetDocViaApi(target, config, now, extraTitle);
      if (!doc.ok) {
        if (doc.error === "connect") break;
        return { ok: false, error: doc.error };
      }

      const appended = await appendViaApi(target, doc.docId, markdown, now, doc.layout, doc.cacheKey, payload);
      if (appended.ok) {
        return {
          ok: true,
          mode: "api",
          docId: doc.docId,
          path: "/" + doc.layout.notebook + "/" + doc.title,
          notebook: doc.notebook,
          baseUrl: target.baseUrl,
          url: target.baseUrl + "/blocks/" + doc.docId,
          title: doc.title,
        };
      }

      // 目标文档已被删除：缓存已在 append 里清掉，重建一次再试
      if (appended.missingParent === true) continue;

      // 连接断了 → 走队列；其他业务错误如实报
      if (!isConnectFailure(appended.error)) {
        return { ok: false, error: appended.error };
      }
      break;
    }
  }

  // 思源没运行（或中途断开）：先存队列，等它启动后补写
  const queued = await enqueue({
    notebook: payload?.notebook || config?.notebook || "",
    folder: "",
    title: dayStamp(now, layout.dateFormat),
    docTitle: extraTitle,
    markdown,
    meta: payload?.meta ?? null,
    // 保留回链所需的上下文，补写时才能标出来源
    syncKind: typeof payload?.syncKind === "string" ? payload.syncKind : "离线暂存",
    sessionId: typeof payload?.sessionId === "string" ? payload.sessionId : "",
    lastError: apiUsable ? "connect-lost" : "offline",
  });
  return {
    ok: true,
    queued: true,
    queueId: queued.id,
    path: "/" + layout.notebook + "/" + dayStamp(now, layout.dateFormat),
    message: "请先打开思源笔记。内容已暂存，思源启动后会自动写入。",
  };
}


/**
 * 调用当前模型生成对话摘要。
 *
 * 设计约束：
 *   1. 动态 import dsh-llm —— 拿不到就返回明确错误，绝不让插件整体崩掉
 *   2. 只在整个窗口同步时触发，且必须用户主动点
 *   3. 超时可控，避免用户干等
 */
const DEFAULT_SUMMARY_PROMPT = [
  "你是一个对话存档编辑。把用户提供的对话记录压缩成一份「可直接归档」的技术纪要，输出中文 Markdown。",
  "",
  "核心原则：",
  "- 信息密度优先。保留具体数值、文件名、路径、命令、参数、报错原文、版本号、ID，不要泛化成「修改了配置」这种空话。",
  "- 有据可查。每条结论都能对应到对话里的具体位置，不推测、不补全、不美化。",
  "- 层级清晰。谁能一眼看出「做了什么、结果如何、还有什么没做」。",
  "",
  "不要写进摘要的内容：",
  "- 不编造对话里没有的指标、限额、版本号、时间、人名。缺就写「未提及」。",
  "- 不替对话做决定，不补全「应该怎么做」，只记录已经发生和已经说过的。",
  "- 不写客套话、不评价好坏、不写「本次对话很有价值」。",
  "",
  "证据分级（重要）：",
  "关键结论要能被验证。用标记区分可信度：",
  "- 直接来自对话原文 → 不加标记",
  "- 你的归纳推论 → 行尾加 `[推断]`",
  "- 对话里提到但没验证、只是设想 → 行尾加 `[未验证]`",
  "- 对话里多处出现且互相印证 → 行尾加 `[已确认]`（不必每句都标，只标重要结论）",
  "",
  "矛盾处理：",
  "- 对话中出现前后不一致的说法（改了又改、方案推翻、报错反复），**不要只记录最终版**，要把转折写出来：先怎样、后来为什么改、最终定成什么。",
  "- 两个结论都有道理但未定论 → 两边都写，标明「未定论」。",
  "",
  "必须按以下结构输出，没有内容的章节直接省略，不要留空标题：",
  "",
  "## 概览",
  "3-4 句话：这是什么任务、最终状态（完成/部分完成/失败）、关键结论。",
  "",
  "## 时间线",
  "先用 `- HH:mm 事件 → 结果` 列出关键节点，然后**必须**配一张 gantt 图把时间轴画出来。",
  "如果对话里能看出日期，带上日期；看不出时间就按相对顺序，gantt 里用 stage 分组即可。",
  "只列有实质进展的节点（决策、改动、验证、失败），不要把每句话都列进去。",
  "",
  "## 主要工作",
  "分小节写实际做了什么，每项写清：改了什么 / 为什么改 / 改成什么样。",
  "涉及文件时写成 `路径:行号`；涉及命令时用行内代码；涉及前后对比时给出旧值 → 新值。",
  "",
  "## 关键信息",
  "用表格整理必须记住的事实（没有就省略）：",
  "| 项目 | 内容 |",
  "|---|---|",
  "| 文件路径 | ... |",
  "| 关键参数 | ... |",
  "| 版本 / 环境 | ... |",
  "| 错误原文 | ... |",
  "",
  "## 问题与解决",
  "逐个列出：现象 → 根因 → 解法。根因要写具体机制，不要只写「修复了 bug」。",
  "如果某个问题没解决，明确写「未解决」并说明卡在哪。",
  "",
  "## 图片与附件",
  "如果对话中提到了截图、图片、文件、附件，列出它们的内容和作用。",
  "例如：`- image.png：思源夜间模式下流程图不可见的截图，用于定位主题撞色问题`。",
  "没有则省略本节。",
  "",
  "## 后续",
  "未完成事项、待验证项、已知风险。没有则省略。",
  "有遗留问题就明确写「卡在哪一步、缺什么条件」，不要含糊带过——留白比写错更糟。",
  "",
  "可视化要求（重要，尽量多画）：",
  "",
  "凡是能用图讲清楚的，就用图，不要只用文字。按内容类型选图：",
  "",
  "| 内容类型 | 用什么图 | mermaid 语法 |",
  "|---|---|---|",
  "| 处理流程、步骤、分支判断 | 流程图 | flowchart TD |",
  "| 时间线、阶段推进、任务排期 | 甘特图 | gantt |",
  "| 多方交互、请求响应 | 时序图 | sequenceDiagram |",
  "| 状态流转、生命周期 | 状态图 | stateDiagram-v2 |",
  "| 占比、构成、分布 | 饼图 | pie |",
  "| 模块关系、依赖、类结构 | 类图 | classDiagram |",
  "| 层级结构、主题分解 | 思维导图 | mindmap |",
  "",
  "具体要求：",
  "1. **时间线章节必须同时配一张 gantt 图**，把关键节点按时间轴画出来，不要只有文字列表。",
  "2. 对话涉及任何流程、状态变化、多步骤决策，**必须**画 flowchart 或 stateDiagram。",
  "3. 出现「占比、大部分、主要几种、分布」这类描述时，**必须**画 pie 图量化。",
  "4. 涉及多个模块/文件/服务之间的关系，画 classDiagram 或 flowchart 表示连接。",
  "5. 图放在对应章节正文之后，图前不加「如下所示」这类废话。",
  "6. 节点文字要简短（不超过 12 个字），用具体名词，不要写「步骤一」「处理数据」这种空话。",
  "7. 数据不足不要硬画：pie 图至少要有 2 个可量化的类别，gantt 至少 2 个时间点。",
  "8. pie 图类别超过 6 个时，合并成「其他」，不要画出 10 个扇区。",
  "9. 结构化对比优先用表格，不要为了凑图把表格画成图。",
  "",
  "图的数量：中等长度对话通常 1-3 张，长对话可以更多。宁可多画一张帮助理解，也不要一整篇全是文字。",
  "",
  "格式约束：",
  "- 只输出 Markdown 正文，不要用 \`\`\`markdown 把整体包起来。",
  "- 不写「以上是摘要」「希望对你有帮助」这类客套话。",
  "- 长对话控制在 1200 字以内，短对话不要硬凑。",
].join("\n");


/**
 * 生成摘要。
 * @param ctx - 插件上下文（取 llm 与当前模型路由）
 * @param transcript - 原始对话 Markdown
 * @param options - { timeoutMs }
 * @returns {{ ok: boolean, summary?: string, error?: string }}
 */
/**
 * 找出当前可用的 provider/model 组合。
 * 优先用会话默认，其次取列表第一个有模型的 provider。
 */
async function pickRoute(ctx, llm) {
  // 首选：DSH 的「当前会话默认模型」，和用户正在用的模型一致
  try {
    const selection = ctx?.agentDefaultModel?.currentSelection?.();
    if (selection !== null && selection !== undefined
      && typeof selection.provider === "string" && selection.provider !== ""
      && typeof selection.model === "string" && selection.model !== "") {
      return { provider: selection.provider, model: selection.model };
    }
  } catch {
    // 继续尝试下面的方法
  }

  // 兜底：从已注册的 provider 里挑第一个
  try {
    const providers = typeof llm.listProviders === "function" ? await llm.listProviders() : [];
    const list = Array.isArray(providers) ? providers : [];

    for (const entry of list) {
      const provider = typeof entry === "string" ? entry : (entry?.id ?? entry?.name ?? entry?.provider);
      if (typeof provider !== "string" || provider === "") continue;

      let model = typeof entry?.defaultModel === "string" ? entry.defaultModel : "";
      if (model === "" && typeof llm.listModels === "function") {
        const models = await llm.listModels(provider).catch(() => []);
        const first = Array.isArray(models) ? models[0] : null;
        model = typeof first === "string" ? first : (first?.id ?? first?.name ?? "");
      }
      if (typeof model === "string" && model !== "") return { provider, model };
    }
    return null;
  } catch {
    return null;
  }
}

async function summarizeTranscript(ctxForRoute, llm, transcript, options) {
  const text = String(transcript ?? "").trim();
  if (text === "") return { ok: false, error: "没有可摘要的内容" };

  // 提示词可自定义：为空则用内置模板
  const systemPrompt = typeof options?.system === "string" && options.system.trim() !== ""
    ? options.system
    : DEFAULT_SUMMARY_PROMPT;

  if (llm === null || llm === undefined || typeof llm.prepareCall !== "function") {
    return { ok: false, error: "当前环境没有可用的模型服务" };
  }

  // 不 import 任何 @deepseek-ai 包：插件目录下解析不到，会让功能失效。
  // 消息本质是普通对象（role + content + id），自己构造即可。
  const makeUserMessage = (text) => ({
    id: randomUUID(),
    role: "user",
    source: { kind: "dsh-siyuan-sync" },
    content: [{ type: "text", text: text }],
  });

  const timeoutMs = Number.isFinite(options?.timeoutMs) ? options.timeoutMs : 90000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 截断超长内容，避免超出上下文
    const input = text.length > 24000 ? text.slice(0, 24000) + "\n\n（后续内容过长已截断）" : text;

    // provider/model 必须显式给出，否则 prepareCall 无法路由。
    // 从可用 provider 里取第一个有模型的组合。
    const route = await pickRoute(ctxForRoute, llm);
    if (route === null) return { ok: false, error: "没有可用的模型，请先在设置里配置" };

    const call = await llm.prepareCall(Object.assign({ maxTokens: 2048 }, route), controller.signal);
    const messages = [makeUserMessage(input)];

    // 累积文本。不同版本的 chunk 结构不完全相同，
    // 所以这里做宽松收集：凡是文本片段都收，最后再拼接。
    const parts = [];
    const collect = (node, depth) => {
      if (depth > 6 || node === null || node === undefined) return;
      if (typeof node === "string") {
        parts.push(node);
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) collect(item, depth + 1);
        return;
      }
      if (typeof node !== "object") return;

      // 常见的文本字段
      for (const key of ["text", "delta", "content"]) {
        const value = node[key];
        if (typeof value === "string") parts.push(value);
        else if (value !== null && typeof value === "object") collect(value, depth + 1);
      }
    };

    for await (const chunk of call.stream(Object.assign({}, call.config, {
      messages,
      system: systemPrompt,
      purpose: "dsh-siyuan-summary",
      signal: controller.signal,
    }))) {
      collect(chunk, 0);
    }
    const summary = parts.join("").replace(/\n{3,}/g, "\n\n").trim();
    if (summary === "") return { ok: false, error: "模型没有返回内容" };
    return { ok: true, summary };
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "摘要生成超时（" + Math.round(timeoutMs / 1000) + " 秒）"
      : String(error?.message ?? error);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 查询某段内容是否已经存过。
 * @returns {{ stored: boolean, at?: string, count?: number }}
 */
async function checkDuplicate(target, markdown) {
  const id = fingerprint(markdown);
  const result = await siyuanCall(target.baseUrl, target.token, "/api/query/sql", {
    stmt: "SELECT id, created FROM blocks WHERE ial LIKE '%custom-dsh-fp=\"" + id + "\"%' LIMIT 1",
  }, 8000);

  if (!result.ok) return { stored: false, error: result.error };
  const rows = Array.isArray(result.data) ? result.data : [];
  if (rows.length === 0) return { stored: false, fingerprint: id };

  const created = String(rows[0].created ?? "");
  return {
    stored: true,
    fingerprint: id,
    blockId: String(rows[0].id ?? ""),
    at: created === "" ? undefined : created,
  };
}

// ---------------------------------------------------------------------------
// 插件本体
// ---------------------------------------------------------------------------

export const name = "dsh-siyuan-sync";

/**
 * 依赖声明。llm 用于生成摘要——它由 dsh-base 提供，正常环境一定存在。
 * 若某个精简环境缺 llm，插件仍会启动（cordis 的 inject 只是延迟激活对应回调），
 * 摘要功能会返回明确错误，同步功能不受影响。
 */
export const inject = ["llm", "agentDefaultModel"];

export function apply(ctx) {
  try {
    const logger = ctx.logger ?? console;

    ctx.inject(["webServer"], (scope) => {
      try {
        scope.effect(() => {
          const disposers = [];

          const mount = (path, handler) => {
            try {
              disposers.push(scope.webServer.register({ kind: "exact", path, handler }));
            } catch (error) {
              logger.warn?.(new Error("dsh-siyuan-sync: route " + path + " mount failed: " + String(error?.message ?? error)));
            }
          };

          const guard = (req, res) => {
            if (!loopbackOrigin(req)) {
              json(res, 403, { error: "origin-not-trusted" });
              return false;
            }
            return true;
          };

          // /config — GET 读配置与探测结果，POST 保存配置（同路径只注册一次）
          mount(ROUTE_PREFIX + "/config", async (req, res) => {
            if (!guard(req, res)) return;
            try {
              if (req.method === "GET") {
                const config = await readConfig();
                // 唯一判据：思源内核是否可调用（写入只能走它的 API）。
                const matched = await autoMatchSiyuan(false);
                json(res, 200, {
                  config: {
                    baseUrl: config.baseUrl ?? "",
                    folder: config.folder ?? "",
                    hasToken: typeof config.token === "string" && config.token !== "",
                    // 用户自定义的摘要提示词（空 = 用内置模板）
                    summaryPrompt: typeof config.summaryPrompt === "string" ? config.summaryPrompt : "",
                    preview: config.preview !== false,
                    dedupe: config.dedupe !== false,
                  },
                  layout: resolveLayout(config),
                  defaults: DEFAULT_LAYOUT,
                  matched: matched.ok,
                  matchedBaseUrl: matched.ok ? matched.baseUrl : null,
                  matchedVersion: matched.ok ? matched.version : null,
                  reason: matched.ok ? undefined : matched.reason,
                });
                return;
              }
              if (req.method === "POST") {
                const body = await readJsonBody(req);
                const current = await readConfig();
                const next = { ...current };
                for (const key of ["baseUrl", "token", "notebook", "folder"]) {
                  if (typeof body[key] === "string") next[key] = body[key].trim();
                }
                // 存放规则：只接受合法值，其余交给 resolveLayout 兜底
                if (body.layout !== undefined && body.layout !== null && typeof body.layout === "object") {
                  // 只接收合法值，非法值不写入——否则会把用户之前的设置冲掉。
                  const merged = { ...(current.layout ?? {}) };
                  const incoming = body.layout;
                  if (typeof incoming.notebook === "string" && incoming.notebook.trim() !== "") {
                    merged.notebook = incoming.notebook.trim();
                  }
                  if (typeof incoming.groupByDay === "boolean") merged.groupByDay = incoming.groupByDay;
                  if (incoming.dateFormat === "dash" || incoming.dateFormat === "slash" || incoming.dateFormat === "cn") {
                    merged.dateFormat = incoming.dateFormat;
                  }
                  if (incoming.appendMode === "same" || incoming.appendMode === "separate") {
                    merged.appendMode = incoming.appendMode;
                  }
                  if (typeof incoming.titleTemplate === "string" && incoming.titleTemplate.trim() !== "") {
                    merged.titleTemplate = incoming.titleTemplate.trim();
                  }
                  if (Number.isInteger(incoming.headingLevel) && incoming.headingLevel >= 0 && incoming.headingLevel <= 6) {
                    merged.headingLevel = incoming.headingLevel;
                  }
                  if (typeof incoming.separator === "boolean") merged.separator = incoming.separator;
                  if (typeof incoming.timeLabel === "boolean") merged.timeLabel = incoming.timeLabel;
                  if (["auto", "light", "dark", "high"].includes(incoming.mermaidTheme)) {
                    merged.mermaidTheme = incoming.mermaidTheme;
                  }
                  next.layout = merged;
                }
                // 是否在写入前弹预览
                if (typeof body.preview === "boolean") next.preview = body.preview;
                // 是否在同步前检查重复
                if (typeof body.dedupe === "boolean") next.dedupe = body.dedupe;
                // 自定义摘要提示词（留空则用内置模板）
                if (typeof body.summaryPrompt === "string") next.summaryPrompt = body.summaryPrompt;
                await writeConfig(next);
                json(res, 200, { ok: true, config: next, layout: resolveLayout(next) });
                return;
              }
              json(res, 405, { error: "method not allowed" });
            } catch (error) {
              json(res, 400, { ok: false, error: String(error?.message ?? error) });
            }
          });

          // GET /notebooks — 笔记本列表；?refresh=1 强制重新匹配（点「重新检测」时用）
          mount(ROUTE_PREFIX + "/notebooks", async (req, res) => {
            if (req.method !== "GET") return json(res, 405, { error: "method not allowed" });
            if (!guard(req, res)) return;
            try {
              const url = new URL(req.url ?? "/", "http://localhost");
              json(res, 200, await listNotebooks(await readConfig(), url.searchParams.get("refresh") === "1"));
            } catch (error) {
              json(res, 500, { ok: false, error: String(error?.message ?? error) });
            }
          });

          // POST /ping — 重新探测思源是否可用（设置面板的「重新检测」）
          mount(ROUTE_PREFIX + "/ping", async (req, res) => {
            if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
            if (!guard(req, res)) return;
            try {
              matchCache = null;
              const matched = await autoMatchSiyuan(true);
              if (!matched.ok) {
                json(res, 200, {
                  ok: false,
                  running: false,
                  error: matched.reason === "no-conf"
                    ? "没有找到思源配置，请确认安装过思源笔记"
                    : "没有检测到运行中的思源笔记，请先打开它",
                });
                return;
              }
              json(res, 200, {
                ok: true,
                running: true,
                baseUrl: matched.baseUrl,
                version: matched.version,
              });
            } catch (error) {
              json(res, 500, { ok: false, error: String(error?.message ?? error) });
            }
          });

          // GET /queue — 查看待补写队列
          mount(ROUTE_PREFIX + "/queue", async (req, res) => {
            if (!guard(req, res)) return;
            try {
              if (req.method === "GET") {
                const entries = await listQueue();
                json(res, 200, {
                  ok: true,
                  pending: entries.length,
                  entries: entries.map((entry) => ({
                    id: entry.id,
                    createdAt: entry.createdAt,
                    attempts: entry.attempts ?? 0,
                    title: entry.title,
                    notebook: entry.notebook,
                    lastError: entry.lastError ?? null,
                    lastReason: entry.lastReason ?? null,
                    nextAt: entry.nextAt ?? null,
                    bytes: String(entry.markdown ?? "").length,
                  })),
                });
                return;
              }
              // POST /queue：flush / clear / retry / remove
              if (req.method === "POST") {
                const body = await readJsonBody(req);

                if (body.action === "flush") {
                  matchCache = null;
                  json(res, 200, await flushQueue());
                  return;
                }

                if (body.action === "clear") {
                  const entries = await listQueue();
                  for (const entry of entries) await removeEntry(entry.id);
                  json(res, 200, { ok: true, cleared: entries.length });
                  return;
                }

                // 单条删除：用户明确不要了
                if (body.action === "remove") {
                  const id = String(body.id ?? "");
                  if (id === "") {
                    json(res, 400, { ok: false, error: "缺少 id" });
                    return;
                  }
                  json(res, 200, { ok: true, removed: await removeEntry(id) });
                  return;
                }

                // 单条重试：只跑这一条，失败原因会写回条目
                if (body.action === "retry") {
                  const id = String(body.id ?? "");
                  if (id === "") {
                    json(res, 400, { ok: false, error: "缺少 id" });
                    return;
                  }
                  const entries = await listQueue();
                  const entry = entries.find((item) => item.id === id);
                  if (entry === undefined) {
                    json(res, 404, { ok: false, error: "队列里没有这一条" });
                    return;
                  }
                  matchCache = null;
                  const result = await flushEntry(entry);
                  if (result.ok === true) {
                    await removeEntry(id);
                    json(res, 200, { ok: true, flushed: 1, result });
                    return;
                  }
                  const attempts = Number(entry.attempts ?? 0) + 1;
                  await updateEntry({ ...entry, attempts, lastError: result.error ?? "未知错误" });
                  json(res, 200, { ok: false, deferred: result.deferred === true, error: result.error });
                  return;
                }

                json(res, 400, { ok: false, error: "unknown action" });
                return;
              }
              json(res, 405, { error: "method not allowed" });
            } catch (error) {
              json(res, 500, { ok: false, error: String(error?.message ?? error) });
            }
          });

          // POST /summary — 用当前模型生成对话摘要（仅整窗口同步时使用）
          mount(ROUTE_PREFIX + "/summary", async (req, res) => {
            if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
            if (!guard(req, res)) return;
            try {
              const body = await readJsonBody(req);
              const markdown = String(body?.markdown ?? "");
              if (markdown.trim() === "") {
                json(res, 400, { ok: false, error: "没有可摘要的内容" });
                return;
              }
              const config = await readConfig();
              const result = await summarizeTranscript(ctx, ctx.llm, markdown, {
                timeoutMs: Number.isFinite(body?.timeoutMs) ? body.timeoutMs : 90000,
                system: typeof config?.summaryPrompt === "string" ? config.summaryPrompt : "",
              });
              json(res, 200, result);
            } catch (error) {
              json(res, 500, { ok: false, error: String(error?.message ?? error) });
            }
          });

          // POST /check — 查这段内容是否已经存过（重复检测）
          mount(ROUTE_PREFIX + "/check", async (req, res) => {
            if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
            if (!guard(req, res)) return;
            try {
              const body = await readJsonBody(req);
              const markdown = String(body?.markdown ?? "");
              if (markdown.trim() === "") {
                json(res, 200, { ok: true, stored: false });
                return;
              }
              const config = await readConfig();
              const target = await resolveTarget(config);
              if (target.token === "" || target.detected === false) {
                json(res, 200, { ok: true, stored: false, offline: true });
                return;
              }
              json(res, 200, Object.assign({ ok: true }, await checkDuplicate(target, markdown)));
            } catch (error) {
              json(res, 200, { ok: false, stored: false, error: String(error?.message ?? error) });
            }
          });

          // POST /sync — 同步为思源文档
          mount(ROUTE_PREFIX + "/sync", async (req, res) => {
            if (req.method !== "POST") return json(res, 405, { error: "method not allowed" });
            if (!guard(req, res)) return;
            try {
              const body = await readJsonBody(req);
              const config = await readConfig();
              json(res, 200, await syncDocument(body, config));
            } catch (error) {
              json(res, 400, { ok: false, error: String(error?.message ?? error) });
            }
          });

          return () => {
            for (const dispose of disposers) {
              try { dispose(); } catch { /* 忽略卸载噪音 */ }
            }
          };
        }, "dsh-siyuan-sync: routes");
      } catch (error) {
        logger.warn?.(new Error("dsh-siyuan-sync: webServer mount skipped: " + String(error?.message ?? error)));
      }
    });

    // 后台补写：思源没开时内容已落盘，这里持续尝试把它送进去。
    // 三个触发时机：启动后 5 秒、每 30 秒一次、以及任何一次成功同步之后。
    const QUEUE_INTERVAL_MS = 30000;
    try {
      ctx.effect(() => {
        let stopped = false;
        let timer = null;

        const tick = async () => {
          if (stopped) return;
          try {
            const pending = await listQueue();
            if (pending.length > 0) {
              matchCache = null; // 重新探测：思源可能刚被打开
              const result = await flushQueue();
              if (result.flushed > 0) {
                logger.info?.("dsh-siyuan-sync: 已补写 " + String(result.flushed) + " 条，剩余 " + String(result.remaining));
              }
            }
          } catch (error) {
            logger.warn?.(new Error("dsh-siyuan-sync: queue flush failed: " + String(error?.message ?? error)));
          } finally {
            if (!stopped) timer = setTimeout(tick, QUEUE_INTERVAL_MS);
          }
        };

        timer = setTimeout(tick, 5000);
        return () => {
          stopped = true;
          if (timer !== null) clearTimeout(timer);
        };
      }, "dsh-siyuan-sync: queue flusher");
    } catch (error) {
      logger.warn?.(new Error("dsh-siyuan-sync: queue flusher skipped: " + String(error?.message ?? error)));
    }

    logger.info?.("dsh-siyuan-sync host half ready");
  } catch (error) {
    try { console.warn("[dsh-siyuan-sync] host apply failed:", error); } catch { /* noop */ }
  }
}