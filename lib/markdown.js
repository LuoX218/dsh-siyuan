/**
 * Markdown 组织层：把对话内容排成适合思源的 Markdown。
 *
 * 这一层不碰网络，也不读写文件——纯函数，方便单独测试。
 * 负责：块切分、图表主题注入、自动标签、回链、内容指纹。
 */

// 相对路径导入：本模块与 time.js 同目录
import { fullStamp, dayStamp } from "./time.js";

const DIAGRAM_LANGS = new Set([
  "mermaid", "mindmap", "graphviz", "plantuml", "echarts", "flowchart", "abc", "math",
]);

/**
 * 检查代码块语言是否属于图表类型。
 * 思源靠 "代码块语言" 判断是否渲染成图表：
 *   \`\`\`mermaid  → 流程图/时序图/甘特图
 *   \`\`\`mindmap  → 思维导图
 *   \`\`\`graphviz → 关系图
 * 所以这三类块必须完整保留语言标记和内容。
 */
function isDiagramLang(lang) {
  return DIAGRAM_LANGS.has(String(lang || "").toLowerCase());
}

function splitBlocks(markdown) {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let buffer = [];
  let inFence = false;
  let fenceMark = "";
  let inFormula = false;

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text !== "") blocks.push(text);
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // 代码围栏切换（~~~ 或 ```）
    if (trimmed.startsWith("~~~") || trimmed.startsWith("```")) {
      if (!inFence) {
        inFence = true;
        fenceMark = trimmed.slice(0, 3);
      } else if (trimmed.startsWith(fenceMark)) {
        inFence = false;
      }
      buffer.push(line);
      continue;
    }

    // 公式块 $$...$$：内部必须整体保留，不能被空行切断，
    // 否则 LaTeX 的反斜杠和换行都会丢，公式就渲染不出来。
    if (!inFence && trimmed.startsWith("$$")) {
      if (!inFormula) {
        inFormula = true;
        buffer.push(line);
        // 单行写法 $$...$$ 直接闭合
        if (trimmed.length > 4 && trimmed.endsWith("$$")) inFormula = false;
        continue;
      }
      buffer.push(line);
      inFormula = false;
      continue;
    }

    if (inFence || inFormula) {
      buffer.push(line);
      continue;
    }

    if (trimmed === "") {
      flush();
      continue;
    }

    // 列表连续行归为一块（避免每个列表项单独成段）
    buffer.push(line);
  }
  flush();
  return blocks;
}

/**
 * 追加一段内容。
 *
 * 排版策略（贴合思源的块特性）：
 *   - 段首时间戳作为小标题块（级别由 layout.headingLevel 控制）
 *   - 正文按逻辑块逐个追加，块之间自然形成间距
 *   - 块之间插入分隔线，让多段对话视觉上分得开
 */
/**
 * 组织成适合思源的 Markdown。
 *
 * 排版原则（贴合思源的块模型）：
 *   1. 段与段之间留空行 → 思源会生成独立段落块，而不是挤成一块
 *   2. 多段内容之间插水平分隔线 → 视觉上把「一次同步」与前后区分开
 *   3. 代码块/列表原样保留 → 交给思源自己解析成对应的块类型
 *   4. 时间戳用标题块 → 在思源大纲里能直接跳转
 */
/**
 * 给 mermaid 代码块注入主题自适应指令。
 *
 * 背景：思源在页面加载时按 appearance.mode 决定 mermaid 主题
 *   theme: mode === 1 ? "dark" : "default"
 * 但用户自定义的深色主题（如 midnight）背景比 mermaid 的 dark 主题更深，
 * 图表线条/文字就"融进"背景里看不见了。
 *
 * 解法：用 mermaid 的 init 指令声明主题变量，让图表跟随思源主题，
 * 而不是写死颜色——这样白天/夜间都能看清。
 */
/**
 * mermaid 主题预设。
 *
 * 为什么要提供多套：
 *   思源用 appearance.mode 决定 mermaid 主题（dark / default），
 *   但用户自定义主题的背景色五花八门——比如 midnight 的底色比
 *   mermaid 内置 dark 更深，默认配色就"融"进背景里了。
 *
 *   auto   跟随思源（不注入任何指令，由思源自己决定）
 *   light  浅色（白底深字）
 *   dark   深色（透明底浅字）
 *   high   高对比（黑白分明，深浅背景都清晰）
 */
/**
 * mermaid 主题预设。
 *
 * 问题根源：mermaid 内置 dark 主题的节点背景是 #181818，文字是浅色；
 * 而思源的自定义深色主题（如 midnight）背景也很深，
 * 两者叠在一起，节点边框和连线就"看不见"了。
 *
 * 解法：统一用 theme=base 覆盖所有颜色变量，
 * 并让背景透明——这样图表始终跟随宿主背景，文字用高对比色，
 * 不管白天还是夜间都清晰。
 */
const MERMAID_THEME_VARS = {
  // 节点填充：半透明蓝，配合任意背景都显眼
  primaryColor: "rgba(77,107,254,0.18)",
  // 节点边框：实心蓝，深色浅色背景都能看清
  primaryBorderColor: "#4d6bfe",
  // 连线与箭头：中性灰，明暗背景都有对比
  lineColor: "#8a8a96",
  // 次级元素
  secondaryColor: "rgba(107,138,253,0.18)",
  tertiaryColor: "rgba(128,128,128,0.12)",
  // 文字用 rgba + 混合，深浅背景都能读
  primaryTextColor: "#888888",
  secondaryTextColor: "#888888",
  tertiaryTextColor: "#888888",
  // 标签底色透明，避免盖住背景
  edgeLabelBackground: "transparent",
  noteBkgColor: "rgba(250,204,21,0.16)",
  noteTextColor: "#888888",
  noteBorderColor: "#eab308",
  // 字体
  fontFamily: "sans-serif",
  fontSize: "14px",
};

function buildMermaidInit(overrides) {
  const vars = { ...MERMAID_THEME_VARS, ...(overrides ?? {}) };
  return '%%{init: {"theme": "base", "themeVariables": ' + JSON.stringify(vars) + "}}%%";
}

const MERMAID_PRESETS = {
  // auto：同样注入，但用中性色；这是修复"夜间看不见"的关键默认值
  auto: buildMermaidInit(),
  // 浅色：深字
  light: buildMermaidInit({ primaryTextColor: "#1f1f24", lineColor: "#5a5a66" }),
  // 深色：浅字
  dark: buildMermaidInit({ primaryTextColor: "#e6e6ea", lineColor: "#b4b4c0" }),
  // 高对比：黑白
  high: buildMermaidInit({
    primaryColor: "rgba(128,128,128,0.2)",
    primaryBorderColor: "#000000",
    lineColor: "#000000",
    primaryTextColor: "#000000",
    edgeLabelBackground: "#ffffff",
  }),
};


function mermaidInitOf(layout) {
  const preset = layout?.mermaidTheme;
  if (typeof preset === "string" && Object.prototype.hasOwnProperty.call(MERMAID_PRESETS, preset)) {
    return MERMAID_PRESETS[preset];
  }
  return MERMAID_PRESETS.auto;
}

/**
 * 为 mermaid 代码块补上 init 指令（已有则跳过）。
 * @param {string} block - 单个代码块文本
 * @returns {string}
 */
function withMermaidInit(block, init) {
  const fence = /^(`{3,}|~{3,})mermaid\s*\n([\s\S]*?)\n\1\s*$/.exec(block.trim());
  if (fence === null) return block;

  const marker = fence[1];
  const body = fence[2];

  // 用户自己写了 init 指令就不动
  if (/%%\{init:/.test(body)) return block;

  // auto 模式：不注入，完全交给思源决定主题
  if (typeof init !== "string" || init === "") return block;

  return marker + "mermaid\n" + init + "\n" + body + "\n" + marker;
}

/**
 * 根据内容自动生成标签。
 *
 * 规则来自 layout.autoTags：
 *   [["方案|设计", "方案设计"], ["报错|bug|异常", "问题排查"]]
 * 左边是正则，右边是标签名。
 * 只在命中时才加，避免给每篇都塞一堆无关标签。
 */
function detectTags(text, rules) {
  if (!Array.isArray(rules) || rules.length === 0) return [];
  const sample = String(text || "").slice(0, 4000);
  const out = [];
  for (const rule of rules) {
    if (!Array.isArray(rule) || rule.length < 2) continue;
    const [pattern, tag] = rule;
    if (typeof pattern !== "string" || typeof tag !== "string" || tag === "") continue;
    try {
      if (new RegExp(pattern, "i").test(sample) && !out.includes(tag)) out.push(tag);
    } catch {
      // 非法正则跳过，不影响主流程
    }
  }
  return out;
}

/**
 * 生成回链行：标明这段内容出自哪次对话。
 * 让存到思源的内容可追溯，而不是一堆无来源的文字。
 */
function buildSourceLine(payload, date, existingMarkdown) {
  if (payload?.sourceLine === false) return "";
  const at = fullStamp(date);
  const stamp = dayStamp(date, "dash");
  const parts = ["来源：DeepSeek Harness"];
  const kind = typeof payload?.syncKind === "string" ? payload.syncKind : "";
  if (kind !== "") parts.push(kind);
  if (typeof payload?.sessionId === "string" && payload.sessionId !== "") {
    parts.push("会话 " + payload.sessionId.slice(0, 8));
  }
  if (payload?.turn !== undefined && payload?.turn !== null) parts.push("第 " + String(payload.turn) + " 轮");
  parts.push(stamp + " " + at);
  return "> " + parts.join(" · ");
}

function composeSegment(markdown, date, layout, payload) {
  const level = Number.isInteger(layout?.headingLevel) ? layout.headingLevel : 3;
  const showTime = layout?.timeLabel !== false;
  const normalized = String(markdown).replace(/\r\n/g, "\n").trim();

  const parts = [];
  const head = level >= 1 && level <= 6 ? "#".repeat(level) + " " + fullStamp(date) : "";
  if (head !== "" && showTime) parts.push(head);

  // 自动标签放在正文之前，方便在思源里按标签聚合检索
  const tags = detectTags(normalized, layout?.autoTags);
  if (layout?.tagging !== false && tags.length > 0) {
    parts.push(tags.map((tag) => "#" + tag + "#").join(" "));
  }

  // 正文按空行切分成块，块之间统一留一个空行；
  // mermaid 块按用户选择的主题补指令（auto 则不注入）。
  const init = mermaidInitOf(layout);
  for (const block of splitBlocks(normalized)) parts.push(withMermaidInit(block.trim(), init));

  if (parts.length === 0) return "";

  let body = parts.join("\n\n");

  // 回链：标明出处，方便日后追溯是哪次对话
  const source = buildSourceLine(payload, date, normalized);
  if (source !== "") body += "\n\n" + source;

  if (layout?.separator === false) return body + "\n";

  // 结尾加分隔线前，先去掉正文末尾已有的分隔线，
  // 否则会出现连续两条 ---（正文自带一条 + 我们补的一条）。
  body = body.replace(/\n*---\s*$/, "").replace(/\n{3,}$/, "\n");

  return body + "\n\n---\n";
}

/**
 * 内容指纹：用于识别「这条是不是已经存过」。
 * 只取内容不做格式化，避免空白差异导致指纹不一致。
 */
function fingerprint(text) {
  const normalized = String(text || "").replace(/\s+/g, "").slice(0, 8000);
  let hash = 5381;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  return "dsh" + (hash >>> 0).toString(36);
}

/**
 * 判断错误是不是「目标文档已经不存在」。
 * 常见于用户手动删了文档、或换工作空间后缓存指向了旧 ID。
 */
function isMissingParent(error) {
  return /parent block not found|not found/i.test(String(error ?? ""));
}


export {
  DIAGRAM_LANGS,
  isDiagramLang,
  splitBlocks,
  MERMAID_THEME_VARS,
  buildMermaidInit,
  MERMAID_PRESETS,
  mermaidInitOf,
  withMermaidInit,
  detectTags,
  buildSourceLine,
  composeSegment,
  fingerprint,
  isMissingParent,
};