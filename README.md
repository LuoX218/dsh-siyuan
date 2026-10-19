# dsh-siyuan

**把 DeepSeek Harness 里值得留下的对话，挑出来沉淀成你自己的开发知识库。** 右键选中，笔记就进了思源——公式和 mermaid 图表原样保留。

[中文](#中文) · [English](#english)

---

## 中文

### 为什么需要它

一次开发对话几千字，真正值得留下的可能就那么几段：一个想通的方案、一个踩了半天的坑、一组调出来的参数。剩下的推演和试错，过一周你也不会重读。

问题是这些碎片都埋在里面。整段存下来懒得翻，什么都不存下次重新踩一遍。

这个插件解决**挑选**：

- 你决定存什么——完整一轮，或只是某条讲清楚了问题的消息
- 存进来的部分能直接用——代码、公式、图表保持原样
- 慢慢长成知识库——几个月后搜一下「上次那个内存泄漏怎么定的」就有

思源在这里不是备份盘，是**组织层**：双链、大纲、标签、数据库视图都是现成的。

### 功能

- **三种同步粒度** —— 单条消息 / 本轮对话 / 整个窗口。助手消息的动作条上有「存」图标，Shift+点存整窗口
- **思源没开也不丢** —— 先进本地队列，每 30 秒探一次，思源启动后自动补写
- **写入前可改** —— 弹预览面板，标题和正文都能编辑
- **公式和图表** —— 行内公式、块级公式渲染成思源原生公式块；流程图、时序图、状态图、甘特图、饼图、类图都识别成图表
- **对话气泡** —— 用户蓝色、助手绿色，一眼分清谁说的
- **自动标签** —— 按内容打 `#方案设计#`、`#问题排查#` 这类标签，方便聚合检索
- **回链** —— 每段末尾标明来源的会话、轮次和时间
- **重复检测** —— 同样的内容再同步会提示已存过
- **AI 摘要** —— 整窗口同步时可调用当前模型生成结构化摘要，再连同全文一起存入
- **失败重试** —— 自动退避重试，面板里能看到失败原因

### 效果预览

<span>同步后在思源里的实际渲染效果。</span>

**文本样式与标题** —— 粗体、斜体、删除线、行内代码、超链接、中文标点全部保留

<div align="center">
  <img src="assets/01-text.png" alt="标题层级与文本样式" width="820" />
  <br>
  <sub>标题层级与文本样式</sub>
</div>

**公式** —— 行内公式、块级公式、多行对齐、矩阵，全部渲染成思源原生公式块

<div align="center">
  <img src="assets/02-math.png" alt="公式渲染" width="820" />
  <br>
  <sub>公式渲染</sub>
</div>

**流程图** —— 自动识别 mermaid，渲染成可交互的图形

<div align="center">
  <img src="assets/03-flowchart.png" alt="流程图" width="820" />
  <br>
  <sub>流程图</sub>
</div>

**时序图** —— 多方交互、请求响应顺序一目了然

<div align="center">
  <img src="assets/04-sequence.png" alt="时序图" width="820" />
  <br>
  <sub>时序图</sub>
</div>

**甘特图与饼图** —— 排期用甘特，占比用饼图

<div align="center">
  <img src="assets/05-gantt-pie.png" alt="甘特图与饼图" width="820" />
  <br>
  <sub>甘特图与饼图</sub>
</div>

**思维导图** —— 层级结构自动展开

<div align="center">
  <img src="assets/06-mindmap.png" alt="思维导图" width="820" />
  <br>
  <sub>思维导图</sub>
</div>

**代码块** —— 按语言高亮，缩进和注释完整

<div align="center">
  <img src="assets/07-code.png" alt="代码块高亮" width="820" />
  <br>
  <sub>代码块高亮</sub>
</div>

**表格** —— 对齐方式保留，状态标记正常显示

<div align="center">
  <img src="assets/08-table.png" alt="表格与对齐" width="820" />
  <br>
  <sub>表格与对齐</sub>
</div>

**特殊符号** —— 箭头、数学符号、Emoji 都能正确显示

<div align="center">
  <img src="assets/09-symbols.png" alt="特殊符号与 Emoji" width="820" />
  <br>
  <sub>特殊符号与 Emoji</sub>
</div>

### 怎么用

右键任意消息：

| 菜单项 | 同步范围 |
|---|---|
| 同步这条消息到思源 | 只存这一条 |
| 同步本轮对话 | 这一轮问答 |
| 同步整个窗口的全部对话 | 窗口里所有已加载的对话 |
| 思源笔记设置… | 打开控制面板 |

### 用成知识库的几个习惯

1. **按主题建笔记本** —— 别堆在默认的 `deepseek对话` 里，改成 `架构决策`、`问题排查`、`性能优化`
2. **按价值选粒度** —— 一句话结论存单条，讲清一个问题存本轮，长推演存整窗口 + 摘要
3. **摘要当索引** —— 整窗口生成的摘要把结论和关键参数摘在前面，日常看摘要就够
4. **标签和双链串联** —— 把「当时定的方案」和「后来踩的坑」连起来
5. **定期整理** —— 散的合并成整篇，过时的删掉

### 安装

```sh
git clone https://github.com/LuoX218/dsh-siyuan.git
cd dsh-siyuan
./install.sh
```

重启 Harness，在 **设置 → 插件 → 第三方插件** 里能看到 `dsh-siyuan`。

**思源必须开着**——插件通过思源内核 API 写入，token 从 `conf/conf.json` 自动读取。

### 设置项

设置 → 插件 → dsh-siyuan：

- **存放规则** —— 目标笔记本、日期格式、归类方式、时间标题级别
- **排版** —— 段落分隔线、时间戳、图表配色、自动标签开关
- **摘要** —— 是否先问摘要、摘要提示词（可完全自定义）
- **行为** —— 写入前预览、重复内容提醒

### 已知限制

| 限制 | 原因 |
|---|---|
| 思源必须运行才能写入 | 写入只能走内核 API |
| 思维导图不能直接生成 | 思源的脑图是原生块，需从列表右键转换 |
| 已有内容不会自动更新 | 改了排版设置只影响新同步的内容 |
| 摘要需要先选模型 | 会话没选模型时无法生成 |

### License

MIT

---

## English

**Pick out what's worth keeping from DeepSeek Harness and grow it into your own development knowledge base.** Right-click to save into SiYuan; formulas and mermaid diagrams come through intact.

### Why

A development conversation runs thousands of words. What's actually worth keeping might be a few paragraphs: a design that clicked, a bug that ate an afternoon, a set of tuned parameters. The rest you won't reread.

This plugin is about **selection** — you decide what's kept, what's kept stays usable, and it compounds into a searchable knowledge base.

SiYuan isn't a backup drive here; it's the organization layer: backlinks, outlining, tags, database views.

### Features

- **Three sync scopes** — single message / current turn / whole window. Assistant rows carry a save icon; Shift+click saves the whole window
- **Nothing lost when SiYuan is down** — local queue, probed every 30s, flushed automatically
- **Editable preview** — tweak the title and body before writing
- **Formulas and diagrams** — inline and block math become native SiYuan math blocks; flowchart, sequence, state, gantt, pie, and class diagrams render as diagrams
- **Speaker bubbles** — user in blue, assistant in green
- **Auto tags** — `#design#`, `#troubleshooting#` and friends, for aggregation
- **Backlinks** — each segment notes its session, turn, and timestamp
- **Duplicate detection** — the same content prompts before being saved twice
- **AI summary** — for whole-window syncs, call your current model for a structured summary alongside the transcript
- **Retry with backoff** — failure reasons surface in the panel

### Screenshots

<span>How synced content renders inside SiYuan.</span>

<div align="center">
  <img src="assets/02-math.png" alt="Formulas" width="820" />
  <br>
  <sub>Inline and block formulas become native SiYuan math blocks</sub>
</div>

<div align="center">
  <img src="assets/03-flowchart.png" alt="Flowchart" width="820" />
  <br>
  <sub>Mermaid flowcharts render as interactive diagrams</sub>
</div>

<div align="center">
  <img src="assets/05-gantt-pie.png" alt="Gantt and pie" width="820" />
  <br>
  <sub>Gantt charts for schedules, pie charts for proportions</sub>
</div>

<div align="center">
  <img src="assets/08-table.png" alt="Tables" width="820" />
  <br>
  <sub>Tables keep their alignment and status markers</sub>
</div>

See the <a href="#中文">Chinese section</a> for the full gallery.

### Usage

Right-click any message:

| Item | Scope |
|---|---|
| Sync this message | Just this one |
| Sync this turn | The question-and-answer pair |
| Sync the whole window | Everything loaded |
| SiYuan settings… | Open the panel |

### Install

```sh
git clone https://github.com/LuoX218/dsh-siyuan.git
cd dsh-siyuan
./install.sh
```

Restart Harness; the plugin appears under **Settings → Plugins → Third-party plugins**.

**SiYuan must be running** — writes go through its kernel API, with the token read from `conf/conf.json`.

### Known limitations

| Limitation | Reason |
|---|---|
| SiYuan must be running | Kernel API is the only write path |
| No direct mindmap generation | SiYuan mindmaps are native blocks; convert from a list |
| Existing content isn't updated | Layout changes only affect new syncs |
| Summary needs a selected model | Uses the current session's model |

### License

MIT