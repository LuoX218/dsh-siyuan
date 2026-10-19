# dsh-siyuan

**把 DeepSeek Harness 里值得留下的东西，挑出来沉淀成你自己的开发知识库。** 对话很长，但不是每句都有价值——右键选中那一段，它就成了思源里可双链、可检索、可打标签的正式笔记；格式不丢，公式和 mermaid 图表原样变成思源原生块。

[中文](#中文) · [English](#english)

---

## 中文

### 为什么需要它

一次开发对话动辄几千字。里面真正值得留下的，可能就那么几段：一个想通了的方案、一个踩了半天的坑、一组调出来的参数。剩下的推演、试错、来回确认——再过一周你也不会想重读。

问题是这些碎片都埋在长长的对话里。要么整段存下来（很快就懒得翻），要么什么都不存（下次重新踩一遍）。

这个插件解决的是**挑选**这件事：

- **你决定存什么。** 可以是完整的一轮问答，也可以只是某条把问题讲清楚了的消息。对话内容本身不做全量搬运，你选中的才进笔记库。
- **进来的部分是能用的。** 结论、代码、公式、图表都保持原样，不是一堆缩进错乱的纯文本。在思源里能被双链、被标签聚合、被全文检索。
- **慢慢长成你自己的知识库。** 今天存一段方案推导，明天存一个排查结论。几个月后想找「上次那个内存泄漏是怎么定的」，搜一下就有了——比翻聊天记录快得多。

思源在这套流程里扮演的不是「备份盘」，而是**组织层**：双链、大纲、数据库视图、标签体系都是现成的。插件只负责把挑选出来的内容送进去，格式一点不丢。

手动复制粘贴做不到这些——格式全丢、代码块散架、公式变乱码。

### 怎么把它用成知识库

插件本身不规定你怎么组织，但下面这套用法能很快跑出效果：

**1. 按主题建笔记本，别按时间堆**

默认的 `deepseek对话` 只是开箱设定，不是必须。改成分主题：`架构决策`、`问题排查`、`性能优化`、`踩坑记录`。时间戳保留在段落里，笔记本按主题分类——以后找东西是按「我在想什么」找，不是按「我哪天聊的」找。

**2. 同步粒度按价值选**

| 场景 | 用哪个 |
|---|---|
| 结论就一句话 | 同步这条消息 |
| 一问一答讲清了一个问题 | 同步本轮对话 |
| 一整段推演过程，想完整保留 | 同步整个窗口 + 摘要 |

大多数时候「本轮对话」够用。整窗口配合摘要，适合那种推了很久才想通的复杂问题。

**3. 摘要当索引，全文当附录**

整窗口同步生成的摘要会先把结论、根因、关键参数摘出来放在前面。日常翻笔记看摘要就够了，需要细节再往下拉到全文。

**4. 用标签和双链串起来**

插件会自动打 `#方案设计#`、`#问题排查#` 这类标签。之后再手动补双链——把「当时定的方案」和「后来踩的坑」连起来，知识库才真正成型。

**5. 定期整理**

过一段时间回头看，把散的段落合并成整篇文档，删掉过时的。插件负责把原料送进来，提炼和归档还是得自己来。

### 关于多端同步

如果希望这些笔记在手机上也能看，思源自带几种方案：

> 插件本身不参与同步，只负责把内容写进本地笔记库。写完之后由思源的同步引擎接管——分块、冲突处理、版本历史都和手动编辑的笔记完全一致。

| 方式 | 配置位置 | 说明 |
|---|---|---|
| 思源官方云 | 设置 → 云端 | 付费订阅，开箱即用，增量同步 |
| S3 / 对象存储 | 设置 → 云端 → S3 | 阿里云 OSS、腾讯 COS、七牛、MinIO 等 |
| WebDAV | 设置 → 云端 → WebDAV | 群晖、Nextcloud 等自建 |
| 本地文件同步 | 自行处理 | iCloud / Dropbox 直接同步工作空间目录（注意冲突） |

写入走的是思源内核 API，落盘后由思源的同步引擎接管——所以云同步的分块、冲突处理、版本历史都和手动编辑笔记完全一致。

> 这也是插件坚持不直接读写 `data/` 目录的原因之一：绕开内核写文件会破坏思源的同步元数据，轻则分块丢失，重则整个库损坏。

### 特性

- **三种同步粒度** —— 单条消息 / 本轮对话 / 整个窗口。助手消息的动作条上也挂了「存」图标，直接点存本轮，Shift+点存整窗口
- **思源没开也不丢** —— 内容先进本地队列，每 30 秒探一次，思源启动后自动补写。队列可单独重试、删除、或一次性全补
- **写入前可改** —— 默认弹预览面板，标题和正文都能改；不想每次点两下就在设置里关掉
- **公式** —— 行内 `$E=mc^2$`、块级 `$$...$$` 都渲染成思源的原生公式块（`NodeMathBlock`），不是纯文本
- **mermaid 图表** —— 流程图、时序图、状态图、甘特图、饼图、类图、思维导图，识别后交给思源渲染。DSH 用 shiki 渲染代码块，DOM 上没有语言标记，插件会从首行关键字反推（`flowchart TD` / `sequenceDiagram` / `digraph` 等 10 种）
- **夜间模式不瞎** —— mermaid 内置深色主题的节点背景是 `#181818`，容易和思源自定义深色主题撞色。写入时注入 `theme: base` + 透明背景 + 中性线条色，白天夜间都看得清。仍有问题可在设置里换「强制深色」或「高对比」
- **对话气泡** —— 用户消息是蓝色 NOTE callout，助手是绿色 TIP callout，颜色、图标、边框都不同，扫一眼就知道谁说的
- **自动标签** —— 命中关键词时在正文前插 `#方案设计#`、`#问题排查#` 这类标签，方便在思源里按标签聚合。规则可在设置里改
- **回链** —— 每段末尾标明出处：类型、会话 ID、轮次、时间
- **重复检测** —— 写入时给块打内容指纹，再同步同样的内容会先提示「已存过」，避免堆积
- **AI 摘要** —— 整窗口同步时可调用**你当前正在用的模型**生成归档格式的摘要（概览 / 时间线 / 主要工作 / 关键信息 / 问题与解决 / 后续），再连同全文一起写入。提示词可在设置里完全自定义
- **失败重试** —— 指数退避 30s → 1m → 2m → 5m，最多 8 次；失败归类为 `offline` / `auth` / `missing` / `other`，面板里能直接看到原因
- **文档失效自愈** —— 目标文档被删后，再次同步会自动清缓存重建，不会卡在 `parent block not found`

如果这个插件帮到了你，欢迎给仓库点个 ⭐（[GitHub](https://github.com/LuoX218/dsh-siyuan)）。

### 存放结构

默认写进 `deepseek对话` 笔记本，按日期归档：

```
deepseek对话/
└── 2026-10-20              ← 同一天的对话追加到同一篇
    ├── ### 01:35:00        ← 每次同步一段，以时间戳开头
    │   ├── #方案设计#
    │   ├── > [!NOTE] 👤 我
    │   ├── > [!TIP] 🤖 助手
    │   └── > 来源：...
    ├── ### 02:10:00
    └── ---
```

三级都可在设置里改：笔记本名、日期格式（`2026-10-20` / `2026/10/20` / `2026年10月20日`）、归类方式（同一天一篇 / 每次新建）。

### 安装

```sh
git clone https://github.com/LuoX218/dsh-siyuan.git
cd dsh-siyuan
./install.sh
```

`install.sh` 做三件事：

1. 软链到 `~/.dsh/profiles/desktop/node_modules/`
2. 写入 profile `package.json` 的 `dependencies`
3. 追加到 `dsh.profile.bundles`

装完重启 Harness，在 **设置 → 插件 → 第三方插件** 里能看到 `dsh-siyuan`，可随时启用/停用。

> 国内网络 clone 卡住的话，先给 git 设代理：`git config --global http.proxy http://127.0.0.1:7890`

### 思源侧准备

插件需要思源内核 API 的 token，会自动从这些位置读：

- `~/Library/Application Support/SiYuan/conf/conf.json`（macOS）
- `%APPDATA%/SiYuan/conf/conf.json`（Windows）
- `~/.config/siyuan/conf/conf.json`（Linux）

自定义工作空间可以设环境变量 `SIYUAN_WORKSPACE`。

**思源必须开着才能写入** —— 内核 API 是唯一可用的写入通道。

### 使用

#### 右键菜单

任意消息右键，四项：

| 菜单项 | 同步范围 |
|---|---|
| 同步这条消息到思源 | 只存这一条 |
| 同步本轮对话 | 这一轮（一问一答） |
| 同步整个窗口的全部对话 | 窗口里所有已加载的对话 |
| 思源笔记设置… | 打开控制面板 |

#### 整窗口 + 摘要

选「同步整个窗口」后先弹选择框：

```
同步整个窗口
共 5 轮 · 8,432 字。可以先让 AI 生成一份摘要，再连同全文一起存入思源。

        [取消]  [只存全文]  [提取摘要]
```

点「提取摘要」会调用当前会话正在用的模型（走 `ctx.agentDefaultModel`），生成结构化的归档纪要。用的是内置模板：

| 章节 | 内容 |
|---|---|
| 概览 | 任务是什么、最终状态、关键结论 |
| 时间线 | 节点列表 + **强制配 gantt 图** |
| 主要工作 | 改了什么 / 为什么改 / 改成什么样，含 `路径:行号` |
| 关键信息 | 表格：路径、参数、版本、错误原文 |
| 问题与解决 | 现象 → 根因 → 解法 |
| 图片与附件 | 截图和文件的内容与作用 |
| 后续 | 未完成、待验证、已知风险 |

模板要求关键结论打证据标记：`[已确认]` / `[推断]` / `[未验证]`，并要求把方案的推翻过程写出来（旧方案 → 为什么改 → 新方案），而不是只记最终版。

图表按内容类型自动选：流程用 flowchart、时间线用 gantt、占比用 pie、模块关系用 classDiagram，最多 1-3 张。

不想要摘要？设置里「整窗口同步时」选「直接存全文」。

#### 设置项

**设置 → 插件 → 第三方插件 → dsh-siyuan**，共 16 项：

存放规则：目标笔记本、日期格式、归类方式、每段时间标题级别
排版：段落分隔线、时间戳、图表配色、自动标签
摘要：是否先问摘要、摘要提示词
行为：写入前预览、重复内容提醒

#### 队列

思源没开时内容落到 `~/.dsh/plugin-data/dsh-siyuan-sync/queue/`。设置面板里能看到每一条的标题、字数、相对时间、重试次数和失败原因，可以单独重试或删除，也可以「立即写入 N 条」一起补。

### 为什么不直接写文件

思源官方明确要求：外部程序不要直接读写 `<workspace>/data` 目录，否则可能导致云同步分块丢失或数据损坏。

所以插件：

- 通过 `/api/block/appendBlock`、`/api/filetree/createDocWithMd` 等接口写入
- 只**读** `conf/conf.json` 拿 token，不改任何文件
- 从不碰 `data/` 下的东西

早期版本试过直接生成 `.sy` 文件，结果触发思源的解析错误（`ListData.Typ` 类型不匹配），已彻底移除。

### 已知限制

| 限制 | 原因 |
|---|---|
| 思源必须运行才能写入 | 写入只能走内核 API |
| 思维导图不能直接生成 | 思源的脑图是原生块（`NodeMindmapItem`），只能从列表右键「转换为脑图」 |
| 已有内容不会自动更新 | 改了排版设置只影响新同步的内容 |
| 摘要依赖当前模型 | 会话没选模型时拿不到 `agentDefaultModel` |

### 验证

```sh
E="/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness"
for f in scripts/verify-*.mjs; do
  ELECTRON_RUN_AS_NODE=1 "$E" "$f" && echo "OK $f"
done
```

18 份脚本覆盖：窗口序列化、Markdown 转换、插件面板、队列、UI 样式、公式、图表、语言嗅探、Shiki DOM、换行保留、主题注入、失效文档恢复、提示词配置、角色气泡。

### License

MIT

---

## English

**Pick out what's worth keeping from DeepSeek Harness and grow it into your own development knowledge base.** Conversations are long, but not every line matters — right-click the part that does, and it becomes a proper SiYuan note you can backlink, search, and tag. Formatting survives intact: formulas and mermaid diagrams land as native SiYuan blocks.

### Why

A single development conversation easily runs thousands of words. What's actually worth keeping might be a few paragraphs: a design that finally clicked, a bug that ate an afternoon, a set of parameters you tuned into place. The rest — the false starts, the back-and-forth — you won't want to reread next week.

The problem is those fragments are buried in the middle of everything else. Save the whole transcript and you'll never open it again; save nothing and you'll rediscover the same bug next month.

This plugin is about **selection**:

- **You decide what's kept.** A full turn, or just the one message that explained the problem. Nothing is archived wholesale — only what you pick lands in the library.
- **What lands is usable.** Conclusions, code, formulas, and diagrams keep their structure. Not a wall of mangled plain text. Linkable, taggable, searchable in SiYuan.
- **It compounds into a knowledge base.** A design rationale today, a debugging conclusion tomorrow. Months later, "how did we pin down that memory leak" is a search away — faster than scrolling chat history.

SiYuan isn't a backup drive here; it's the **organization layer**. Backlinks, outlining, database views, and tagging are already built in. The plugin just delivers the curated pieces without losing fidelity.

Copying by hand can't do any of this — formatting is lost, code fences break, formulas mangle.

### Using it as a knowledge base

The plugin doesn't dictate structure, but this approach gets results quickly:

**1. Notebooks by topic, not by date**

`deepseek对话` is a default, not a requirement. Rename it to `architecture`、`debugging`、`performance`、`gotchas`. Timestamps stay inside the segments; the notebook reflects what you were thinking about, not when you talked.

**2. Match sync scope to value**

| Situation | Use |
|---|---|
| The conclusion is one message | Sync this message |
| One exchange settled a question | Sync this turn |
| A long derivation worth keeping whole | Sync the whole window + summary |

"Sync this turn" covers most cases. Whole-window plus summary suits problems that took a while to crack.

**3. Summary as index, transcript as appendix**

Whole-window summaries lead with conclusions, root causes, and key parameters. Read the summary day to day; drop into the transcript when you need detail.

**4. Tie it together with tags and backlinks**

The plugin tags segments automatically (`#design#`, `#troubleshooting#`). Add backlinks by hand — connect "the plan we settled on" to "the bug we hit later" — and it starts acting like a knowledge base.

**5. Prune occasionally**

Every few weeks, merge scattered segments into proper documents and drop what's outdated. The plugin delivers raw material; distillation is still on you.

### About multi-device sync

If you want these notes on your phone, SiYuan has you covered:

> The plugin doesn't sync anything. It writes into the local library; from there SiYuan's sync engine takes over — chunking, conflict handling, and version history behave exactly as they do for manually edited notes.

| Method | Where | Notes |
|---|---|---|
| SiYuan cloud | Settings → Cloud | Paid subscription, works out of the box |
| S3 / object storage | Settings → Cloud → S3 | Aliyun OSS, Tencent COS, Qiniu, MinIO, etc. |
| WebDAV | Settings → Cloud → WebDAV | Synology, Nextcloud, self-hosted |
| File-level sync | Your own setup | iCloud / Dropbox on the workspace (mind conflicts) |

Writes go through the kernel API, so the sync engine takes over afterwards — chunking, conflict handling, and version history behave exactly as they do for manually edited notes.

> This is also why the plugin refuses to touch `data/` directly: bypassing the kernel corrupts SiYuan's sync metadata, leading to lost chunks or a broken library.

### Features

- **Three sync scopes** — single message / current turn / whole window. Assistant rows also carry a "save" icon: click for current turn, Shift+click for the whole window
- **No data loss when SiYuan is down** — content goes to a local queue, probed every 30s, flushed automatically once SiYuan starts. Entries can be retried, deleted, or flushed all at once
- **Preview before write** — an editable panel by default; turn it off in settings if you don't want the extra click
- **Formulas** — inline `$E=mc^2$` and block `$$...$$` both become native SiYuan math blocks (`NodeMathBlock`), not plain text
- **mermaid diagrams** — flowchart, sequence, state, gantt, pie, class, mindmap. DSH highlights code via shiki, which puts no language marker in the DOM, so the plugin infers it from the first line (`flowchart TD`, `sequenceDiagram`, `digraph`, 10 patterns total)
- **Readable in dark mode** — mermaid's built-in dark theme uses `#181818` node backgrounds, which collide with custom SiYuan dark themes. The plugin injects `theme: base` with transparent backgrounds and neutral line colors. Force dark or high contrast available in settings
- **Speaker bubbles** — user messages are blue NOTE callouts, assistant messages green TIP callouts. Different color, icon, and border
- **Auto tags** — inserts `#tag#` before the body when keywords match (`#design#`, `#troubleshooting#`), so you can aggregate by tag in SiYuan. Rules are editable
- **Backlink** — each segment ends with its origin: kind, session ID, turn, timestamp
- **Duplicate detection** — content fingerprints on written blocks; syncing the same content again prompts "already saved"
- **AI summary** — for whole-window syncs, calls **the model you're currently using** to produce an archival-format summary (overview / timeline / work log / key facts / problems & fixes / follow-ups), then writes it together with the transcript. Prompt fully customizable in settings
- **Retry with backoff** — 30s → 1m → 2m → 5m, max 8 attempts; failures classified as `offline` / `auth` / `missing` / `other`
- **Self-healing documents** — if the target doc was deleted, the next sync clears the cache and recreates it instead of failing with `parent block not found`

### Install

```sh
git clone https://github.com/LuoX218/dsh-siyuan.git
cd dsh-siyuan
./install.sh
```

`install.sh` symlinks the plugin into `~/.dsh/profiles/desktop/node_modules/`, adds it to the profile's `dependencies`, and appends it to `dsh.profile.bundles`.

Restart Harness afterwards. The plugin appears under **Settings → Plugins → Third-party plugins** as `dsh-siyuan`.

### SiYuan side

The plugin reads the kernel API token from `conf/conf.json` automatically (macOS / Windows / Linux paths covered). Set `SIYUAN_WORKSPACE` for a custom workspace.

**SiYuan must be running** — the kernel API is the only supported write path.

### Usage

Right-click any message:

| Item | Scope |
|---|---|
| Sync this message | Just this one |
| Sync this turn | The question-and-answer pair |
| Sync the whole window | Everything loaded in the window |
| SiYuan settings… | Open the control panel |

Whole-window syncs offer an optional AI summary before writing. The built-in template produces: overview, timeline (with a mandatory gantt chart), work log with `path:line` references, a key-facts table, problem → root cause → fix, image/attachment notes, and follow-ups. Key conclusions are tagged `[confirmed]` / `[inferred]` / `[unverified]`, and superseded approaches are recorded rather than erased.

### Why not write files directly

SiYuan's own guidance forbids external programs from touching `<workspace>/data` — it risks sync-chunk loss or corruption. The plugin therefore writes only through kernel APIs, reads `conf/conf.json` read-only, and never touches `data/`.

An early version did generate `.sy` files directly; it triggered SiYuan parse errors (`ListData.Typ` mismatch) and was removed.

### Known limitations

| Limitation | Reason |
|---|---|
| SiYuan must be running | Kernel API is the only write path |
| No direct mindmap generation | SiYuan mindmaps are native blocks (`NodeMindmapItem`); convert from a list manually |
| Existing content isn't updated | Layout changes only affect new syncs |
| Summary needs a selected model | Uses `agentDefaultModel` from the current session |

### License

MIT
