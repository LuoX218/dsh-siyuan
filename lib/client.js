window.__ModuleLoader__.load({
	id: "dsh-siyuan-sync",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const ReactDOM = require("react-dom");
		const h = React.createElement;

		/**
		 * 思源同步 —— 浏览器半部分。
		 *
		 * 稳定性约定：
		 * - 只依赖 react / react-dom 两个静态种子模块，缺一个就整体降级为无操作。
		 * - apply() 整体 try/catch；组件渲染也包一层，出错返回 null。
		 * - 右键只在 [data-chat-flow-key] 消息行内接管，其余上下文菜单不受影响。
		 */

		const NS = "dsh-siyuan-sync";
		const ROUTE = "/plugins/dsh-siyuan-sync";
		const EVENT = "dsh-siyuan-sync:request";
		const TICK = String.fromCharCode(96);

		//#region ---------- 样式 ----------
		/**
		 * 样式刻意用「自包含」的做法：
		 * - 主按钮用真实十六进制色值，不依赖主题变量（深色主题下
		 *   --dsw-alias-button-primary-fill 是浅色，配白字会看不见）
		 * - 间距用统一的 4px 栅格，分区之间有清晰的分隔
		 */
		const CSS = [
			// ---- 弹层骨架 ----
			".siy-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.42);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px}",
			".siy-dialog{box-sizing:border-box;width:min(560px,100%);max-height:calc(100vh - 96px);overflow:auto;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1a1a1a);border:.5px solid var(--dsw-alias-border-l3,rgba(0,0,0,.16));border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.36);padding:22px 24px 20px}",
			".siy-dialog h2{margin:0 0 6px;font-size:16px;font-weight:600;letter-spacing:.2px}",
			".siy-hint{color:var(--dsw-alias-label-tertiary,#8a8a8a);font-size:12px;line-height:18px;margin:0 0 16px}",
			".siy-subhead{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8a8a8a);margin:22px 0 10px}",
			".siy-subhead::after{content:'';flex:1;height:.5px;background:var(--dsw-alias-border-l2,rgba(0,0,0,.1))}",
			// ---- 表单 ----
			".siy-field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}",
			".siy-label{font-size:12px;color:var(--dsw-alias-label-secondary,#6b6b6b);line-height:16px}",
			".siy-input,.siy-select{box-sizing:border-box;width:100%;height:34px;border:.5px solid var(--dsw-alias-border-l4,rgba(0,0,0,.2));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.03));color:inherit;font:inherit;font-size:13px;padding:0 10px;outline:none;transition:border-color .12s,box-shadow .12s}",
			".siy-input:focus,.siy-select:focus{border-color:#4d6bfe;box-shadow:0 0 0 3px rgba(77,107,254,.18)}",
			".siy-input::placeholder{color:var(--dsw-alias-label-caption,#9a9a9a)}",
			".siy-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
			// ---- 状态条 ----
			".siy-status{font-size:12px;line-height:18px;padding:9px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.04));margin-bottom:10px;word-break:break-all}",
			".siy-status[data-ok=true]{background:rgba(18,134,76,.12);color:#12864c}",
			".siy-status[data-ok=false]{background:rgba(196,41,31,.12);color:#c4291f}",
			".siy-status[data-ok=pending]{color:var(--dsw-alias-label-tertiary,#8a8a8a)}",
			// ---- 按钮：主按钮用固定色值，避免主题变量在深色模式下翻白 ----
			".siy-btn{height:34px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l4,rgba(0,0,0,.2));background:transparent;color:inherit;font:inherit;font-size:13px;font-weight:500;padding:0 16px;cursor:pointer;transition:background-color .12s,border-color .12s,opacity .12s}",
			".siy-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}",
			".siy-btn:disabled{opacity:.45;cursor:default}",
			".siy-btn-primary{border-color:transparent !important;background:#4d6bfe !important;color:#fff !important;box-shadow:0 1px 2px rgba(0,0,0,.12)}",
			".siy-btn-primary:hover:not(:disabled){background:#3f5ae0 !important}",
			".siy-btn-primary:disabled{opacity:.45}",
			".siy-row{display:flex;gap:10px;align-items:center;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}",
			".siy-row .siy-spacer{flex:1}",
			// ---- 预览 ----
			".siy-preview{width:min(720px,100%);display:flex;flex-direction:column;max-height:calc(100vh - 96px)}",
			".siy-preview-text{box-sizing:border-box;width:100%;min-height:240px;max-height:46vh;resize:vertical;border:.5px solid var(--dsw-alias-border-l4,rgba(0,0,0,.2));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.03));color:inherit;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:20px;padding:12px 14px;outline:none;white-space:pre-wrap;transition:border-color .12s,box-shadow .12s}",
			".siy-preview-text:focus{border-color:#4d6bfe;box-shadow:0 0 0 3px rgba(77,107,254,.18)}",
			".siy-meta{display:flex;gap:12px;align-items:center;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a);margin-top:6px}",
			// ---- 右键菜单 ----
			".siy-menu{position:fixed;z-index:2147483001;min-width:212px;padding:5px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1a1a1a);border:.5px solid var(--dsw-alias-border-l3,rgba(0,0,0,.16));border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,.28);font-size:13px}",
			".siy-menu button{display:flex;width:100%;align-items:center;height:32px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:inherit;font:inherit;font-size:13px;text-align:left;cursor:pointer}",
			".siy-menu button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.07))}",
			".siy-menu .siy-sep{height:.5px;margin:5px 8px;background:var(--dsw-alias-border-l2,rgba(0,0,0,.1))}",
			// ---- 队列 ----
			".siy-queue-row{display:flex;align-items:center;gap:8px;padding:9px 11px;border:.5px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));border-radius:8px;margin-bottom:6px;font-size:12px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.02))}",
			".siy-queue-meta{flex:1;min-width:0}",
			".siy-queue-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}",
			".siy-queue-sub{color:var(--dsw-alias-label-tertiary,#8a8a8a);font-size:11px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".siy-mini{height:26px;padding:0 10px;font-size:11px;font-weight:500;border-radius:6px;border:.5px solid var(--dsw-alias-border-l4,rgba(0,0,0,.2));background:transparent;color:inherit;cursor:pointer;transition:background-color .12s}",
			".siy-mini:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}",
			".siy-mini:disabled{opacity:.4;cursor:default}",
			".siy-mini[data-danger=true]{color:#c4291f;border-color:rgba(196,41,31,.4)}",
			".siy-mini[data-danger=true]:hover:not(:disabled){background:rgba(196,41,31,.1)}",
			// ---- 内嵌与提示 ----
			".siy-embedded{display:block}",
			".siy-dialog-flat{border:0;box-shadow:none;padding:0;background:transparent;width:100%;max-height:none;overflow:visible}",
			".siy-summary{color:var(--dsw-alias-label-secondary,#6b6b6b);font-size:12px;line-height:18px}",
			".siy-toast{position:fixed;left:50%;bottom:40px;transform:translateX(-50%);z-index:2147483002;max-width:min(560px,calc(100vw - 48px));padding:11px 18px;border-radius:10px;background:#1f1f1f;color:#fff;font-size:13px;line-height:20px;box-shadow:0 12px 32px rgba(0,0,0,.32);word-break:break-all}",
			".siy-toast[data-error=true]{background:#c4291f}",
			".siy-toast{display:flex;align-items:center;gap:12px}",

			".siy-narrow{width:min(420px,100%)}",
			".siy-prompt-text{box-sizing:border-box;width:100%;min-height:110px;max-height:240px;resize:vertical;border:.5px solid var(--dsw-alias-border-l4,rgba(0,0,0,.2));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.03));color:inherit;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:19px;padding:10px 12px;outline:none;transition:border-color .12s,box-shadow .12s}",
			".siy-prompt-text:focus{border-color:#4d6bfe;box-shadow:0 0 0 3px rgba(77,107,254,.18)}",
			".siy-prompt-text::placeholder{color:var(--dsw-alias-label-caption,#9a9a9a)}",
		].join("\n");

		function injectCss() {
			try {
				if (typeof document === "undefined") return;
				if (document.querySelector('style[data-plugin="' + NS + '"]') !== null) return;
				const tag = document.createElement("style");
				tag.dataset.plugin = NS;
				tag.textContent = CSS;
				document.head.appendChild(tag);
			} catch (error) { void error; }
		}

		//#region ---------- 请求 ----------
		/**
		 * 桌面端页面的源是 dsh-app://app，所有 Host 请求必须走同源的相对路径，
		 * 由 Electron 的 protocol handler 转发到真正的 Host。
		 *
		 * 之前这里拼了 streamBaseUrl（http://127.0.0.1:端口）导致跨域：
		 * 页面在 dsh-app:// 下，请求直接被拦掉，Promise 永远不 reject，
		 * 面板就卡死在「正在读取配置」。浏览器版同源，直接用相对路径即可。
		 */
		const IS_DESKTOP = (() => {
			try {
				return typeof location !== "undefined" && location.protocol === "dsh-app:";
			} catch (error) { void error; return false; }
		})();

		function apiBase() {
			if (IS_DESKTOP) return "";
			try {
				const transport = globalThis.__DSH_TRANSPORT__;
				// 仅当页面本身不是 Host 源时才需要绝对地址（纯 web 远端场景）。
				if (transport && typeof transport.streamBaseUrl === "string" && transport.streamBaseUrl !== "") {
					if (typeof location === "undefined" || location.origin !== transport.streamBaseUrl) {
						return transport.streamBaseUrl.replace(/\/+$/, "");
					}
				}
			} catch (error) { void error; }
			return "";
		}

		const REQUEST_TIMEOUT_MS = 12000;

		async function api(path, init) {
			const controller = typeof AbortController === "function" ? new AbortController() : null;
			const timer = controller === null ? null : window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
			try {
				const res = await fetch(apiBase() + ROUTE + path, Object.assign(
					{ credentials: "include" },
					init || {},
					controller === null ? {} : { signal: controller.signal },
				));
				const text = await res.text();
				let body = null;
				try { body = JSON.parse(text); } catch (error) { void error; body = null; }
				if (!res.ok) {
					throw new Error((body && body.error) || "HTTP " + res.status);
				}
				return body;
			} catch (error) {
				if (error && error.name === "AbortError") {
					throw new Error("请求超时（" + Math.round(REQUEST_TIMEOUT_MS / 1000) + " 秒）");
				}
				throw error;
			} finally {
				if (timer !== null) window.clearTimeout(timer);
			}
		}

		//#region ---------- DOM -> Markdown ----------
		const SKIP = new Set(["BUTTON", "SVG", "STYLE", "SCRIPT", "INPUT", "TEXTAREA", "SELECT"]);

		/** 行内元素：出现在块级容器里时按下标转换，不能只取纯文本（否则链接会丢 href）。 */
		const INLINE = new Set([
			"A", "STRONG", "B", "EM", "I", "DEL", "S", "CODE", "SPAN", "SMALL", "MARK",
			"SUB", "SUP", "KBD", "ABBR", "TIME", "CITE", "Q", "U", "IMG",
		]);

		/**
		 * 取代码块的语言标记（mermaid / mindmap / graphviz / js ...）。
		 *
		 * 不同渲染器给的落点不一样，这里按可靠性依次尝试：
		 *   1. <pre class="language-x">  或  <code class="language-x">
		 *   2. data-language / data-lang 属性
		 *   3. 代码块头部单独显示的标签（例如右上角那行 "mermaid"）
		 */
		/**
		 * 取出代码块的原始文本，保住换行。
		 *
		 * shiki 把每行放进独立的 <span class="line">，这些 span 之间
		 * 没有真实换行文本节点，直接 textContent 会把所有行黏成一行。
		 * 这里按可靠性依次尝试三种重建方式。
		 */
		function codeText(el) {
			const strip = (s) => String(s || "").replace(/[\u200b-\u200f\u2060\ufeff]/g, "");

			// 1) 标准 shiki：每行一个 .line
			const lines = Array.from(el.querySelectorAll(".line"));
			if (lines.length > 0) {
				return lines.map((line) => strip(line.textContent)).join("\n");
			}

			// 2) 逐个子节点遍历：遇到 <br> 或块级元素就换行
			const codeEl = el.querySelector("code") || el;
			const parts = [];
			(function walk(node, depth) {
				if (depth > 8 || node === null || node === undefined) return;
				if (node.nodeType === 3) {
					parts.push(strip(node.nodeValue));
					return;
				}
				if (node.nodeType !== 1) return;
				const tag = String(node.tagName || "").toUpperCase();
				if (tag === "BR") {
					parts.push("\n");
					return;
				}
				const blockSpan = node.classList && node.classList.contains("line");
				if (blockSpan) {
					parts.push(strip(node.textContent) + "\n");
					return;
				}
				for (const child of Array.from(node.childNodes || [])) walk(child, depth + 1);
			})(codeEl, 0);

			const joined = parts.join("");
			if (joined.trim() !== "") {
				// 去掉因为块级处理产生的多余尾换行
				return joined.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "");
			}

			// 3) 最后兜底：原始文本
			return strip(el.textContent);
		}

		function codeLanguage(el) {
			const code = el.querySelector("code");

			// 1) class 上的 language-xxx
			const cls = [
				el.getAttribute("class") || "",
				code !== null ? (code.getAttribute?.("class") || code.className || "") : "",
			].join(" ");
			const byClass = /language-([A-Za-z0-9_+#.-]+)/.exec(cls);
			if (byClass !== null) return byClass[1].toLowerCase();

			// 2) data-* 属性
			for (const attr of ["data-language", "data-lang", "language"]) {
				const value = el.getAttribute(attr) || (code !== null && code.getAttribute ? code.getAttribute(attr) : null);
				if (typeof value === "string" && value.trim() !== "") return value.trim().toLowerCase();
			}

			// 3) 代码块头部标签：DSH 会在块顶部显示语言名
			const label = el.querySelector("[data-code-language], .md-code-block-language, .code-language");
			if (label !== null) {
				const text = (label.textContent || "").trim().toLowerCase();
				// 顶部标签如果只是占位词（"language" / "code"），不算有效语言
				if (text !== "" && text !== "language" && text !== "code" && text !== "text") return text;
			}

			// 4) 内容嗅探：DSH 用 shiki 高亮，语言信息只存在 React props 里，
			//    DOM 上拿不到，所以从首行关键字反推图表类型。
			const body = (code !== null ? code.textContent : el.textContent) || "";
			const sniffed = sniffDiagramLanguage(body);
			if (sniffed !== "") return sniffed;

			return "";
		}

		/**
		 * 从代码内容反推图表语言。
		 * 只识别特征明确的几种，避免误判普通代码。
		 */
		function sniffDiagramLanguage(text) {
			// shiki 的输出里会混入零宽字符（\u200b），先清掉再判断，
			// 否则 "flowchart TD" 前面有个零宽空格就匹配不上了。
			const cleaned = String(text || "")
				.replace(/[\u200b-\u200f\u2060\ufeff]/g, "")
				.replace(/\r\n/g, "\n");
			// shiki 把每行包在 span.line 里，行尾常带零宽字符；
			// 按行切分并逐行清理，才能稳定拿到首行关键字。
			const head = cleaned
				.split("\n")
				.map((line) => line.replace(/[\u200b-\u200f\u2060\ufeff]/g, "").trim())
				.filter((line) => line !== "")
				.slice(0, 3);
			if (head.length === 0) return "";

			const first = head[0].toLowerCase();

			// mermaid 的各种图类型
			if (/^(flowchart|graph)\s+(td|tb|lr|rl|bt|tt)\b/.test(first)) return "mermaid";
			if (/^(sequencediagram|classdiagram|statediagram(-v2)?|erdiagram|journey|gantt|pie|gitgraph|mindmap|timeline|quadrantchart|requirementdiagram|c4context|sankey-beta|xychart-beta|block-beta)\b/i.test(first)) {
				return "mermaid";
			}

			// graphviz
			if (/^(digraph|graph|strict\s+(di)?graph)\b/.test(first)) return "graphviz";

			// plantuml
			if (/^@startuml/i.test(first)) return "plantuml";

			// echarts（JSON 开始且含 series）
			if (first.startsWith("{") && /"series"\s*:/.test(head)) return "echarts";

			return "";
		}

		function inlineMd(node) {
			if (node === null || node === undefined) return "";
			if (node.nodeType === 3) return node.nodeValue || "";
			if (node.nodeType !== 1) return "";
			const el = node;
			if (SKIP.has(el.tagName)) return "";
			if (el.getAttribute("aria-hidden") === "true") return "";

			// 行内公式同样只保留一份 LaTeX
			const math = katexOf(el);
			if (math !== null) return mathToMarkdown(math, false);

			switch (el.tagName) {
				case "BR": return "\n";
				case "STRONG": case "B": return "**" + childrenInline(el) + "**";
				case "EM": case "I": return "*" + childrenInline(el) + "*";
				case "DEL": case "S": return "~~" + childrenInline(el) + "~~";
				case "CODE": return TICK + (el.textContent || "") + TICK;
				case "A": {
					const href = el.getAttribute("href");
					const label = childrenInline(el);
					return href && href !== "" ? "[" + label + "](" + href + ")" : label;
				}
				case "IMG": {
					const alt = el.getAttribute("alt") || "";
					const src = el.getAttribute("src") || "";
					return src === "" ? alt : "![" + alt + "](" + src + ")";
				}
				default: return childrenInline(el);
			}
		}

		function childrenInline(el) {
			let out = "";
			for (const child of Array.from(el.childNodes)) out += inlineMd(child);
			return out;
		}

		/**
		 * 识别 KaTeX 渲染出的公式，取出原始 LaTeX。
		 *
		 * DSH 用 KaTeX 渲染公式，DOM 里会同时存在两份：
		 *   <span class="katex-mathml"><math><semantics><annotation>$LaTeX$</annotation>...  ← 源码
		 *   <span class="katex-html">...可视字符...</span>                                    ← 渲染结果
		 * 如果两份都当文本抓，就会得到「渲染结果 + 源码重复一遍」。
		 * 所以这里只取 annotation 里的源码，其余丢弃。
		 *
		 * @returns {{ latex: string, display: boolean } | null}
		 */
		function katexOf(el) {
			try {
				if (!el.classList || !el.classList.contains("katex")) return null;
				const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
				let latex = annotation !== null ? (annotation.textContent || "") : "";
				if (latex === "") {
					const mathml = el.querySelector(".katex-mathml");
					latex = mathml !== null ? (mathml.textContent || "") : "";
				}
				latex = latex.trim();
				if (latex === "") return null;
				// 块级判定：自己或任意祖先带 katex-display
				let isBlock = false;
				let cursor = el;
				for (let depth = 0; cursor !== null && cursor !== undefined && depth < 5; depth += 1) {
					if (cursor.classList && cursor.classList.contains("katex-display")) {
						isBlock = true;
						break;
					}
					cursor = cursor.parentElement;
				}
				return { latex: latex, display: isBlock };
			} catch (error) {
				void error;
				return null;
			}
		}

		/** 把 LaTeX 包成思源能识别的形式。 */
		function mathToMarkdown(math, block) {
			const inner = math.latex.replace(/^\$+/, "").replace(/\$+$/, "").trim();
			return block ? "\n\n$$\n" + inner + "\n$$\n\n" : "$" + inner + "$";
		}

		function blockMd(node, depth) {
			if (node === null || node === undefined) return "";
			if (node.nodeType === 3) return node.nodeValue || "";
			if (node.nodeType !== 1) return "";
			const el = node;
			if (SKIP.has(el.tagName)) return "";
			if (el.getAttribute("aria-hidden") === "true") return "";
			if (el.hasAttribute("data-actions-reveal")) return "";

			// 块级公式的外层容器：直接在这里取内部 .katex 的源码，
			// 否则会继续下钻，导致 display 判定丢失。
			if (el.classList && el.classList.contains("katex-display")) {
				const inner = el.querySelector(".katex");
				const math = katexOf(inner !== null ? inner : el);
				if (math !== null) return mathToMarkdown(math, true);
			}

			// 行内/其它 KaTeX 结构：只输出一份 LaTeX
			const math = katexOf(el);
			if (math !== null) return mathToMarkdown(math, math.display);

			switch (el.tagName) {
				case "PRE": {
					const lang = codeLanguage(el);
					const code = codeText(el);
					return "\n\n~~~" + lang + "\n" + code.replace(/\n+$/, "") + "\n~~~\n\n";
				}
				case "H1": case "H2": case "H3": case "H4": case "H5": case "H6": {
					const level = Number(el.tagName.slice(1));
					return "\n\n" + "#".repeat(level) + " " + inlineMd(el).trim() + "\n\n";
				}
				case "P": return "\n\n" + inlineMd(el).trim() + "\n\n";
				case "UL": case "OL": {
					const ordered = el.tagName === "OL";
					let index = 1;
					let out = "\n";
					for (const li of Array.from(el.children)) {
						if (li.tagName !== "LI") continue;
						const marker = ordered ? String(index++) + ". " : "- ";
						const text = childrenBlock(li, depth + 1).trim().replace(/\n/g, "\n" + "  ".repeat(depth + 1));
						out += "  ".repeat(depth) + marker + text + "\n";
					}
					return out + "\n";
				}
				case "BLOCKQUOTE": {
					const body = childrenBlock(el, depth).trim();
					return "\n\n" + body.split("\n").map((line) => "> " + line).join("\n") + "\n\n";
				}
				case "HR": return "\n\n---\n\n";
				case "TABLE": {
					const rows = Array.from(el.querySelectorAll("tr"));
					if (rows.length === 0) return "";
					const cells = rows.map((row) => Array.from(row.children).map((cell) => inlineMd(cell).trim().replace(/\|/g, "\\|")));
					const width = Math.max.apply(null, cells.map((row) => row.length));
					const pad = (row) => { const copy = row.slice(); while (copy.length < width) copy.push(""); return copy; };
					let out = "\n\n";
					out += "| " + pad(cells[0]).join(" | ") + " |\n";
					out += "| " + pad(cells[0]).map(() => "---").join(" | ") + " |\n";
					for (const row of cells.slice(1)) out += "| " + pad(row).join(" | ") + " |\n";
					return out + "\n";
				}
				case "BR": return "\n";
				default: return INLINE.has(el.tagName) ? inlineMd(el) : childrenBlock(el, depth);
			}
		}

		function childrenBlock(el, depth) {
			let out = "";
			for (const child of Array.from(el.childNodes)) out += blockMd(child, depth);
			return out;
		}

		function tidy(markdown) {
			return String(markdown)
				.split("\u00a0").join(" ")
				.replace(/[ \t]+\n/g, "\n")
				.replace(/\n{3,}/g, "\n\n")
				.trim();
		}

		function serializeRow(row) {
			try {
				const clone = row.cloneNode(true);
				const noise = Array.from(clone.querySelectorAll("[data-actions-reveal], button, svg, [aria-hidden='true'], [data-siy-ui]"));
				for (const node of noise) node.remove();
				return tidy(childrenBlock(clone, 0));
			} catch (error) {
				void error;
				return tidy(row.innerText || "");
			}
		}

		function kindOf(row) {
			const kind = row.getAttribute("data-chat-flow-kind") || "";
			if (kind === "user" || kind === "steering") return "用户";
			if (kind === "assistant-step" || kind === "turn-tail") return "助手";
			return "";
		}

		/**
		 * 把一条消息包成「谁说的」区块。
		 *
		 * 直接加粗标签在小屏幕上分不清，这里用两种区分：
		 *   - 用户：四级标题 + 引用块（灰底），标记 👤
		 *   - 助手：四级标题 + 普通段落，标记 🤖
		 * 标题带 emoji，思源大纲里按标题就能扫读角色。
		 */
/**
 * 把一条消息排成「对话气泡」样式。
 *
 * 思源没有原生的左右气泡，但可以用 callout 块做出接近的效果：
 *   - 用户   → NOTE 类型 callout（蓝色边），整体用引用块再包一层做缩进
 *   - 助手   → TIP  类型 callout（绿色边），不缩进
 * 两者颜色、图标、缩进都不同，扫一眼就能区分。
 *
 * callout 内容里的每行都要带 "> "，否则思源会把第二行甩到块外。
 */
		function speakerBlock(label, text) {
			const body = String(text || "").trim();
			if (body === "") return "";

			// callout 内部：空行保留为 ">"，其余加 "> " 前缀
			const inner = body.split("\n").map((line) => {
				const trimmed = line.replace(/\s+$/, "");
				return trimmed.trim() === "" ? ">" : "> " + trimmed;
			}).join("\n");

			if (label === "用户") {
				return [
					"> [!NOTE] 👤 **我**",
					">",
					inner,
				].join("\n");
			}

			if (label === "助手") {
				return [
					"> [!TIP] 🤖 **助手**",
					">",
					inner,
				].join("\n");
			}

			// 角色未知（例如系统提示）：不包 callout，保持原样
			return body;
		}

		function rowsOfTurn(turn) {
			const selector = '[data-chat-turn="' + String(turn) + '"][data-chat-flow-key]';
			return Array.from(document.querySelectorAll(selector)).filter((row) => !row.hasAttribute("hidden"));
		}

		/**
		 * 当前 DOM 里已经渲染出来的消息行，按文档顺序。
		 *
		 * 注意：DSH 的行有嵌套（一条消息里可能再包一层同属性的容器），
		 * 所以这里按「最外层且带 data-chat-turn」来过滤，避免同一条被算两次。
		 */
		function visibleRows() {
			const all = Array.from(document.querySelectorAll("[data-chat-flow-key][data-chat-turn]"))
				.filter((row) => !row.hasAttribute("hidden"));
			// 丢掉「祖先也在结果里」的节点，只保留最外层。
			return all.filter((row) => !all.some((other) => other !== row && (() => {
				try { return other.contains(row); } catch { return false; }
			})()));
		}

		/** 当前窗口里已渲染的轮次编号，升序去重。 */
		function loadedTurns() {
			const turns = new Set();
			for (const row of visibleRows()) {
				const value = Number(row.getAttribute("data-chat-turn"));
				if (Number.isFinite(value)) turns.add(value);
			}
			return Array.from(turns).sort((a, b) => a - b);
		}

		/** 是否存在还没加载的更早轮次（分页锚点）。 */
		function hasOlderPages() {
			return document.querySelector("[data-chat-paging-anchor]") !== null;
		}

		/**
		 * 抓取整个窗口的对话。
		 *
		 * 注意：DSH 的聊天是分页渲染的，只有「已加载」的轮次在 DOM 里。
		 * 所以这里能抓多少抓多少，并如实返回是否完整——不假装抓全了。
		 *
		 * @returns {{ markdown: string, turns: number, complete: boolean, firstTurn: number|null }}
		 */
		function serializeWindow() {
			const rows = visibleRows();
			if (rows.length === 0) return { markdown: "", turns: 0, complete: true, firstTurn: null };

			const turns = loadedTurns();
			const firstTurn = turns.length > 0 ? turns[0] : null;
			// 只有「有分页锚点」才说明更早的轮次还没加载。
			const complete = !hasOlderPages();

			const sections = [];
			let currentTurn = null;
			for (const row of rows) {
				const turn = row.getAttribute("data-chat-turn");
				if (turn === null || turn === "") continue;
				const text = serializeRow(row);
				if (text === "") continue;
				if (turn !== currentTurn) {
					if (currentTurn !== null) sections.push("");
					sections.push("## 第 " + turn + " 轮");
					currentTurn = turn;
				}
				const label = kindOf(row);
				sections.push(speakerBlock(label, text));
				sections.push("");
			}

			const markdown = tidy(sections.join("\n"));
			return {
				markdown,
				turns: turns.length,
				complete: !hasOlderPages(),
				firstTurn,
			};
		}

		function documentTitle(text) {
			const lines = String(text).split("\n").map((line) => line.trim());
			const first = lines.find((line) => line !== "" && !/^#{1,6}\s*$/.test(line)) || "DSH 对话";
			const plain = first.replace(/^#{1,6}\s*/, "").replace(/[*_~\[>\]]/g, "").trim();
			return plain.slice(0, 48) || "DSH 对话";
		}

		/** 把存放规则描述成人话，显示在面板顶部。 */
		function describeLayout(layout, date) {
			const nb = (layout && layout.notebook) || "deepseek对话";
			if (layout && layout.appendMode === "separate") {
				return nb + " / 每次新建文档";
			}
			const fmt = (layout && layout.dateFormat) || "dash";
			const d = date instanceof Date ? date : new Date();
			const pad = (n) => String(n).padStart(2, "0");
			const y = d.getFullYear();
			const m = pad(d.getMonth() + 1);
			const day = pad(d.getDate());
			const stamp = fmt === "slash" ? y + "/" + m + "/" + day
				: fmt === "cn" ? y + "年" + Number(m) + "月" + Number(day) + "日"
				: y + "-" + m + "-" + day;
			return nb + " / " + stamp + "（同一天追加到同一篇）";
		}

		/** 相对时间，用于队列条目。 */
		function formatWhen(value) {
			if (typeof value !== "string" || value === "") return "";
			const at = new Date(value);
			if (Number.isNaN(at.getTime())) return "";
			const diff = Date.now() - at.getTime();
			const min = Math.floor(diff / 60000);
			if (min < 1) return "刚刚";
			if (min < 60) return String(min) + " 分钟前";
			const hours = Math.floor(min / 60);
			if (hours < 24) return String(hours) + " 小时前";
			return at.toLocaleDateString();
		}

		function dayStampLocal(date) {
			const d = date instanceof Date ? date : new Date();
			const pad = (n) => String(n).padStart(2, "0");
			return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
		}

		function timestamp() {
			const d = new Date();
			const pad = (n) => String(n).padStart(2, "0");
			return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " +
				pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
		}

		//#region ---------- 控制器 ----------
		function createController(sessionId) {
			const listeners = new Set();
			const state = {
				menu: null,
				dialog: false,
				toast: null,
				busy: false,
				// 预览面板：{ markdown, docTitle, original }
				preview: null,
				// 重复提示：{ payload, text, blockId }
				duplicate: null,
				// 整窗口同步时的「摘要 / 全文」选择：{ transcript, title, turns }
				summaryChoice: null,
				summaryBusy: false,
			};
			// 运行时偏好（是否预览），由面板加载后写回
			const prefsRef = { current: { preview: true, dedupe: true, summaryPrompt: true } };
			let seq = 0;

			const emit = () => {
				for (const listener of listeners) listener();
			};
			const setState = (patch) => {
				Object.assign(state, patch);
				emit();
			};

			const toast = (text, isError, action) => {
				const id = ++seq;
				setState({ toast: { id: id, text: text, error: isError === true } });
				window.setTimeout(() => {
					if (state.toast && state.toast.id === id) setState({ toast: null });
				}, isError ? 6000 : 3200);
			};

			/** 真正发送请求（预览确认后调用）。 */
			const sendPayload = async (payload) => {
				if (state.busy) return;
				setState({ busy: true });
				try {
					const result = await api("/sync", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(Object.assign({ sessionId: sessionId }, payload)),
					});
					if (result && result.ok) {
						if (result.queued === true) {
							// 明确告诉用户该做什么，而不是含糊地说"已暂存"。
							toast("请先打开思源笔记。内容已暂存，思源启动后会自动写入", true);
						} else {
							toast("已存入思源：" + (result.path || result.docId || ""), false);
						}
					} else {
						toast("同步失败：" + ((result && result.error) || "未知错误"), true);
					}
				} catch (error) {
					toast("同步失败：" + String((error && error.message) || error), true);
				} finally {
					setState({ busy: false });
				}
			};

			/**
			 * 统一入口：默认先弹预览，用户确认后才写入。
			 * 可在设置里关掉预览（preview=false）直接写。
			 */
			/**
			 * 同步前查重：已经存过的内容会提示，避免重复堆积。
			 * 查询失败不影响正常同步。
			 */
			const checkDuplicate = async (markdown) => {
				try {
					const result = await api("/check", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ markdown: markdown }),
					});
					return result !== null && result.stored === true ? result : null;
				} catch (error) {
					void error;
					return null;
				}
			};

			const syncPayload = async (payload) => {
				if (state.busy) return;
				// 调试：把即将发送的内容记下来，便于排查代码块语言识别问题
				try {
					if (globalThis.dshSiyuan && globalThis.dshSiyuan.lastPayload !== undefined) {
						globalThis.dshSiyuan.lastPayload = payload;
					}
				} catch (error) { void error; }

				// 查重：已存过的内容给出提示（可在设置里关闭）
				if (prefsRef.current.dedupe !== false) {
					const dup = await checkDuplicate(String(payload?.markdown ?? ""));
					if (dup !== null) {
						const when = formatWhen(dup.at);
						setState({
							duplicate: {
								payload: payload,
								text: when === "" ? "这段内容之前已经存过" : "这段内容 " + when + " 已存过",
								blockId: dup.blockId ?? "",
							},
						});
						return;
					}
				}

				if (prefsRef.current.preview === false) {
					return sendPayload(payload);
				}
				setState({
					preview: {
						markdown: String(payload?.markdown ?? ""),
						docTitle: String(payload?.docTitle ?? ""),
						original: payload,
					},
				});
			};

			const confirmPreview = async (editedMarkdown, docTitle) => {
				const current = state.preview;
				if (current === null) return;
				setState({ preview: null });
				const payload = Object.assign({}, current.original, {
					markdown: editedMarkdown,
					docTitle: docTitle,
				});
				return sendPayload(payload);
			};

			const cancelPreview = () => setState({ preview: null });

			const syncRow = (row) => {
				const text = serializeRow(row);
				if (text === "") { toast("这条消息没有可同步的文本", true); return; }
				const label = kindOf(row);
				const turn = row.getAttribute("data-chat-turn") || "";
				const markdown = speakerBlock(label, text);
				// 来源行由 Host 统一生成，避免两边各写一份
				return syncPayload({
					markdown: markdown,
					title: documentTitle(text) + "（" + timestamp() + "）",
					syncKind: "单条消息",
					turn: turn === "" ? undefined : Number(turn),
				});
			};

			const syncTurn = (turn) => {
				const rows = rowsOfTurn(turn);
				if (rows.length === 0) { toast("没找到这一轮的消息", true); return; }
				const sections = [];
				for (const row of rows) {
					const text = serializeRow(row);
					if (text === "") continue;
					const label = kindOf(row);
					sections.push(speakerBlock(label, text));
				}
				if (sections.length === 0) { toast("这一轮没有可同步的文本", true); return; }
				const markdown = sections.join("\n\n---\n\n");
				return syncPayload({
					markdown: markdown,
					title: documentTitle(sections[0]) + "（第 " + turn + " 轮）",
					syncKind: "本轮对话",
					turn: Number(turn),
				});
			};

			/** 同步整个窗口：把已加载的全部轮次整理成一篇。 */
			const syncWindow = () => {
				const snapshot = serializeWindow();
				if (snapshot.markdown === "") {
					toast("这个窗口还没有可同步的内容", true);
					return;
				}
				const head = "### 完整对话记录 · " + timestamp() + "\n\n";
				const note = snapshot.complete
					? ""
					: "\n\n> 注意：这个窗口较早的对话尚未加载，以上只包含已加载的 " + String(snapshot.turns) + " 轮。先向上滚动可加载更多。";
				const markdown = head + snapshot.markdown + note;
				if (!snapshot.complete) {
					toast("同步已加载的 " + String(snapshot.turns) + " 轮（更早的尚未加载）", false);
				}
				// 整窗口同步：先给出「摘要 / 全文」两个选择（可在设置里跳过）
				if (prefsRef.current.summaryPrompt !== false) {
					setState({
						summaryChoice: {
							transcript: markdown,
							title: "完整对话 " + timestamp(),
							turns: snapshot.turns,
						},
					});
					return;
				}
				return syncPayload({ markdown: markdown, title: "完整对话 " + timestamp() });
			};

			/** 生成摘要（调用当前模型）。 */
			const extractSummary = async () => {
				const choice = state.summaryChoice;
				if (choice === null) return;
				setState({ summaryBusy: true });
				try {
					const result = await api("/summary", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ markdown: choice.transcript }),
					});

					if (result && result.ok === true && typeof result.summary === "string" && result.summary !== "") {
						setState({ summaryChoice: null, summaryBusy: false });
						// 摘要 + 全文一起存：摘要在前，全文可折叠
						const markdown = "## 摘要\n\n" + result.summary.trim() +
							"\n\n---\n\n## 完整对话\n\n" + choice.transcript;
						return syncPayload({ markdown: markdown, title: choice.title, syncKind: "整窗口（含摘要）" });
					}
					setState({ summaryBusy: false });
					toast("摘要生成失败：" + ((result && result.error) || "未知错误"), true);
				} catch (error) {
					setState({ summaryBusy: false });
					toast("摘要生成失败：" + String((error && error.message) || error), true);
				}
			};

			const cancelSummaryChoice = () => setState({ summaryChoice: null });

			const syncFullOnly = () => {
				const choice = state.summaryChoice;
				if (choice === null) return;
				setState({ summaryChoice: null });
				return syncPayload({ markdown: choice.transcript, title: choice.title, syncKind: "整窗口" });
			};

			const onRequest = (event) => {
				try {
					const detail = event.detail || {};
					if (detail.kind === "sync-turn" && detail.turn !== undefined && detail.turn !== null) syncTurn(detail.turn);
					else if (detail.kind === "settings") setState({ dialog: true });
				} catch (error) { void error; }
			};
			document.addEventListener(EVENT, onRequest);

			return {
				subscribe(listener) {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
				getState() { return state; },
				openMenu(menu) { setState({ menu: menu }); },
				closeMenu() { setState({ menu: null }); },
				openDialog() { setState({ dialog: true, menu: null }); },
				closeDialog() { setState({ dialog: false }); },
				syncRow: syncRow,
				syncTurn: syncTurn,
				syncWindow: syncWindow,
				confirmPreview: confirmPreview,
				cancelPreview: cancelPreview,
				dismissDuplicate: () => setState({ duplicate: null }),
				extractSummary: extractSummary,
				cancelSummaryChoice: cancelSummaryChoice,
				syncFullOnly: syncFullOnly,
				forceSync: (payload) => {
					setState({ duplicate: null });
					// 跳过查重与预览，直接写入
					return sendPayload(payload);
				},
				setPrefs: (next) => {
					prefsRef.current = Object.assign({}, prefsRef.current, next ?? {});
				},
				getPrefs: () => prefsRef.current,
				toast: toast,
				dispose() { document.removeEventListener(EVENT, onRequest); listeners.clear(); },
			};
		}

		//#region ---------- 右键菜单 ----------
		function ContextMenu({ menu, controller }) {
			React.useEffect(() => {
				if (menu === null) return undefined;
				const close = () => controller.closeMenu();
				const onPointer = (event) => {
					const node = event.target;
					if (node instanceof Element && node.closest("[data-siy-menu]") !== null) return;
					close();
				};
				const onKey = (event) => { if (event.key === "Escape") close(); };
				document.addEventListener("pointerdown", onPointer, true);
				document.addEventListener("keydown", onKey, true);
				window.addEventListener("blur", close);
				window.addEventListener("scroll", close, true);
				return () => {
					document.removeEventListener("pointerdown", onPointer, true);
					document.removeEventListener("keydown", onKey, true);
					window.removeEventListener("blur", close);
					window.removeEventListener("scroll", close, true);
				};
				// 依赖用稳定的布尔值：菜单开/关时重装监听，其余变化不触发
			}, [menu !== null, controller]);

			if (menu === null) return null;
			const style = {
				left: Math.min(menu.x, window.innerWidth - 232) + "px",
				top: Math.min(menu.y, window.innerHeight - 136) + "px",
			};
			return ReactDOM.createPortal(
				h("div", { className: "siy-menu", style: style, "data-siy-menu": "", role: "menu" },
					h("button", {
						type: "button",
						onClick: () => {
							const row = menu.row;
							controller.closeMenu();
							if (row) controller.syncRow(row);
						},
						children: "同步这条消息到思源",
					}),
					h("button", {
						type: "button",
						onClick: () => {
							const turn = menu.turn;
							controller.closeMenu();
							controller.syncTurn(turn);
						},
						children: "同步本轮对话",
					}),
					h("button", {
						type: "button",
						onClick: () => {
							controller.closeMenu();
							controller.syncWindow();
						},
						children: "同步整个窗口的全部对话",
					}),
					h("div", { className: "siy-sep" }),
					h("button", { type: "button", onClick: () => controller.openDialog(), children: "思源笔记设置…" })
				),
				document.body
			);
		}

		//#region ---------- 同步预览 ----------
		/**
		 * 写入前的预览：可以改标题、改正文，确认后才真正写。
		 * 关掉预览（设置里）就直接写。
		 */
		function PreviewDialog({ preview, controller }) {
			const [draft, setDraft] = React.useState(preview.markdown);
			const [docTitle, setDocTitle] = React.useState(preview.docTitle || "");
			const [busy, setBusy] = React.useState(false);

			// 换了一条内容就重置草稿
			React.useEffect(() => {
				setDraft(preview.markdown);
				setDocTitle(preview.docTitle || "");
			}, [preview.markdown, preview.docTitle]);

			// Esc 关闭，Cmd/Ctrl+Enter 直接写入
			React.useEffect(() => {
				const onKey = (event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						controller.cancelPreview();
						return;
					}
					if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
						event.preventDefault();
						if (!busy && draft.trim() !== "") confirm();
					}
				};
				document.addEventListener("keydown", onKey, true);
				return () => document.removeEventListener("keydown", onKey, true);
			}, [draft, busy]);

			const lineCount = draft.split("\n").length;
			const charCount = draft.length;
			const empty = draft.trim() === "";

			const confirm = async () => {
				if (busy || empty) return;
				setBusy(true);
				try {
					await controller.confirmPreview(draft, docTitle);
				} finally {
					setBusy(false);
				}
			};

			return ReactDOM.createPortal(
				h("div", { className: "siy-backdrop", onClick: () => controller.cancelPreview() },
					h("div", {
						className: "siy-dialog siy-preview",
						onClick: (event) => event.stopPropagation(),
					},
						// 标题区
						h("div", { key: "head" },
							h("h2", null, "确认要存入的内容"),
							h("p", { className: "siy-hint" },
								"可以先改标题和正文，确认后写入思源。⌘/Ctrl + Enter 快速写入，Esc 取消。")
						),
						// 标题输入（独立文档模式才生效，所以标清用途）
						h("div", { className: "siy-field", key: "title" },
							h("label", { className: "siy-label" }, "文档标题 · 仅在「每次新建文档」模式下生效"),
							h("input", {
								className: "siy-input",
								type: "text",
								value: docTitle,
								placeholder: "留空则按日期自动命名",
								onChange: (event) => setDocTitle(event.target.value),
							})
						),
						// 正文
						h("div", { className: "siy-field", key: "body" },
							h("label", { className: "siy-label" }, "正文内容"),
							h("textarea", {
								className: "siy-preview-text",
								value: draft,
								onChange: (event) => setDraft(event.target.value),
								spellCheck: false,
								autoFocus: true,
							}),
							h("div", { className: "siy-meta" },
								h("span", null, String(lineCount) + " 行"),
								h("span", null, "·"),
								h("span", null, String(charCount) + " 字"),
								empty ? h("span", null, "· 内容为空无法写入") : null
							)
						),
						// 操作区：左侧提示剩余步骤，右侧按钮
						h("div", { className: "siy-row", key: "actions" },
							h("span", { className: "siy-meta" }, "写入后可在思源对应笔记本中查看"),
							h("span", { className: "siy-spacer" }),
							h("button", {
								type: "button",
								className: "siy-btn",
								onClick: () => controller.cancelPreview(),
								children: "取消",
							}),
							h("button", {
								type: "button",
								className: "siy-btn siy-btn-primary",
								disabled: busy || empty,
								onClick: confirm,
								children: busy ? "写入中…" : "确认写入",
							})
						)
					)
				),
				document.body
			);
		}


		//#region ---------- 整窗口：摘要选择 ----------
		/**
		 * 同步整个窗口时的入口：先问要不要 AI 摘要。
		 * 只有整窗口同步才出现，其它同步方式不打扰用户。
		 */
		function SummaryChoice({ choice, busy, controller }) {
			const chars = choice.transcript.length;
			return ReactDOM.createPortal(
				h("div", { className: "siy-backdrop", onClick: () => controller.cancelSummaryChoice() },
					h("div", { className: "siy-dialog siy-narrow", onClick: (event) => event.stopPropagation() },
						h("h2", null, "同步整个窗口"),
						h("p", { className: "siy-hint" },
							"共 " + String(choice.turns) + " 轮 · " + String(chars) + " 字。" +
							"可以先让 AI 生成一份摘要，再连同全文一起存入思源。"),
						busy
							? h("div", { className: "siy-status", "data-ok": "pending" },
								"正在调用当前模型生成摘要，请稍候…")
							: null,
						h("div", { className: "siy-row" },
							h("button", {
								type: "button",
								className: "siy-btn",
								disabled: busy,
								onClick: () => controller.cancelSummaryChoice(),
								children: "取消",
							}),
							h("button", {
								type: "button",
								className: "siy-btn",
								disabled: busy,
								onClick: () => controller.syncFullOnly(),
								children: "只存全文",
							}),
							h("button", {
								type: "button",
								className: "siy-btn siy-btn-primary",
								disabled: busy,
								onClick: () => controller.extractSummary(),
								children: busy ? "生成中…" : "提取摘要",
							})
						)
					)
				),
				document.body
			);
		}

		//#region ---------- 重复提示 ----------
		/**
		 * 内容已存过时的提示条：可以「仍然再存一份」或取消。
		 */
		function DuplicatePrompt({ duplicate, controller }) {
			const proceed = () => {
				const payload = duplicate.payload;
				controller.dismissDuplicate();
				// 用户明确要再存一份：走正常流程（此时不再查重）
				controller.forceSync(payload);
			};
			return ReactDOM.createPortal(
				h("div", { className: "siy-backdrop", onClick: () => controller.dismissDuplicate() },
					h("div", { className: "siy-dialog siy-narrow", onClick: (event) => event.stopPropagation() },
						h("h2", null, "这段内容已经存过了"),
						h("p", { className: "siy-hint" }, duplicate.text + "。要再存一份吗？"),
						h("div", { className: "siy-row" },
							h("button", {
								type: "button",
								className: "siy-btn",
								onClick: () => controller.dismissDuplicate(),
								children: "不用了",
							}),
							h("button", {
								type: "button",
								className: "siy-btn siy-btn-primary",
								onClick: proceed,
								children: "仍然存入",
							})
						)
					)
				),
				document.body
			);
		}

		//#region ---------- 设置面板 ----------
		/**
		 * 控制面板。现在是「零配置」：
		 * 首次用插件管理或右键打开时自动定位思源工作空间，
		 * 之后即使思源不启动也能直接往目录写。
		 * 存放规则固定为 deepseek对话/当天日期（两级），不再需要选笔记本。
		 */
		function SettingsDialog({ controller, embedded }) {
			const [config, setConfig] = React.useState(null);
			const [status, setStatus] = React.useState({ phase: "loading" });
			const [message, setMessage] = React.useState(null);
			const [busy, setBusy] = React.useState(false);
			const [pending, setPending] = React.useState(0);
			const [queueEntries, setQueueEntries] = React.useState([]);
			const [layout, setLayout] = React.useState(null);
			const [defaults, setDefaults] = React.useState(null);
			const [previewOn, setPreviewOn] = React.useState(true);
			const [dedupeOn, setDedupeOn] = React.useState(true);
			const [summaryPromptOn, setSummaryPromptOn] = React.useState(true);
			const [promptText, setPromptText] = React.useState("");
			const [busyId, setBusyId] = React.useState(null);
			const aliveRef = React.useRef(true);

			const loadQueue = React.useCallback(async () => {
				try {
					const info = await api("/queue");
					if (!aliveRef.current) return;
					setPending(info && typeof info.pending === "number" ? info.pending : 0);
					setQueueEntries(Array.isArray(info?.entries) ? info.entries : []);
				} catch (error) {
					void error;
				}
			}, []);

			/** 队列单条操作：retry / remove。 */
			const queueAction = async (action, id) => {
				if (busyId !== null) return;
				setBusyId(id + ":" + action);
				try {
					const result = await api("/queue", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ action: action, id: id }),
					});
					if (result && result.ok === false) {
						setMessage({ ok: false, text: result.error || "操作失败" });
					} else if (action === "retry") {
						setMessage({ ok: true, text: "已补写成功" });
					}
					await loadQueue();
				} catch (error) {
					setMessage({ ok: false, text: String((error && error.message) || error) });
				} finally {
					if (aliveRef.current) setBusyId(null);
				}
			};

			/** 保存存放规则的一项。 */
			const saveLayout = async (patch) => {
				try {
					const next = await api("/config", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ layout: patch }),
					});
					if (next && next.ok) {
						if (next.layout !== undefined) setLayout(next.layout);
						setMessage({ ok: true, text: "已保存" });
						return true;
					}
					setMessage({ ok: false, text: "保存失败" });
					return false;
				} catch (error) {
					setMessage({ ok: false, text: "保存失败：" + String((error && error.message) || error) });
					return false;
				}
			};

			const load = React.useCallback(async () => {
				setStatus({ phase: "loading" });
				setMessage(null);
				try {
					const info = await api("/config");
					if (!aliveRef.current) return;
					setConfig(info.config || {});
					// 存放规则与默认值
					if (info.layout !== undefined && info.layout !== null) setLayout(info.layout);
					if (info.defaults !== undefined && info.defaults !== null) setDefaults(info.defaults);
					const previewEnabled = !(info.config && info.config.preview === false);
					setPreviewOn(previewEnabled);
					const dedupeEnabled = !(info.config && info.config.dedupe === false);
					setDedupeOn(dedupeEnabled);
					controller.setPrefs({ preview: previewEnabled, dedupe: dedupeEnabled });
					setPromptText(typeof info.config?.summaryPrompt === "string" ? info.config.summaryPrompt : "");
					// 只在思源真正可调用时才算 ready。
					if (info.matched === true) {
						setStatus({ phase: "ready", baseUrl: info.matchedBaseUrl, version: info.matchedVersion });
					} else {
						setStatus({ phase: "offline", reason: info.reason });
					}
					await loadQueue();
				} catch (error) {
					if (!aliveRef.current) return;
					setStatus({ phase: "error", detail: String((error && error.message) || error) });
					setConfig((prev) => prev ?? {});
				}
			}, [loadQueue]);

			React.useEffect(() => {
				aliveRef.current = true;
				load();
				return () => { aliveRef.current = false; };
			}, [load]);

			const rescan = async () => {
				setBusy(true);
				setStatus({ phase: "loading" });
				setMessage(null);
				try {
					const result = await api("/ping", { method: "POST" });
					if (!aliveRef.current) return;
					if (result && result.ok && result.running === true) {
						setStatus({ phase: "ready", baseUrl: result.baseUrl, version: result.version });
						await loadQueue();
					} else {
						setStatus({ phase: "offline" });
						setMessage({ ok: false, text: "没有检测到运行中的思源笔记，请先打开它" });
					}
				} catch (error) {
					if (!aliveRef.current) return;
					setStatus({ phase: "error", detail: String((error && error.message) || error) });
				} finally {
					if (aliveRef.current) setBusy(false);
				}
			};

			const flushQueue = async () => {
				setBusy(true);
				try {
					const result = await api("/queue", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ action: "flush" }),
					});
					if (!aliveRef.current) return;
					if (result && result.ok) {
						setMessage({ ok: true, text: "已补写 " + String(result.flushed ?? 0) + " 条" });
					} else {
						setMessage({ ok: false, text: "补写失败" });
					}
					await loadQueue();
				} catch (error) {
					if (!aliveRef.current) return;
					setMessage({ ok: false, text: "补写失败：" + String((error && error.message) || error) });
				} finally {
					if (aliveRef.current) setBusy(false);
				}
			};

			const shell = (children) => {
				if (embedded === true) {
					return h("div", { className: "siy-embedded" }, h("div", { className: "siy-dialog siy-dialog-flat" }, children));
				}
				return ReactDOM.createPortal(
					h("div", { className: "siy-backdrop", onClick: () => controller.closeDialog() },
						h("div", { className: "siy-dialog", onClick: (event) => event.stopPropagation() }, children)
					),
					document.body
				);
			};

			const statusView = (() => {
				if (status.phase === "loading") return { tone: "pending", text: "正在检测思源笔记…" };
				if (status.phase === "ready") {
					const version = status.version ? " · v" + String(status.version) : "";
					return { tone: "true", text: "已连接思源 " + (status.baseUrl || "") + version };
				}
				if (status.phase === "offline") {
					return {
						tone: "false",
						text: "⚠ 请先打开思源笔记。思源的写入接口由它自己的内核提供，未运行时无法写入；现在同步的内容会暂存，等它启动后自动补写。",
					};
				}
				return { tone: "false", text: "读取配置失败：" + (status.detail || "未知错误") };
			})();

			const ready = status.phase === "ready";

			if (!config) {
				return shell([
					h("h2", { key: "t" }, "dsh-siyuan"),
					h("div", { key: "s", className: "siy-status", "data-ok": "pending" }, "正在连接…"),
				]);
			}

			return shell([
				h("h2", { key: "title" }, "dsh-siyuan"),
				h("p", { className: "siy-hint", key: "hint" },
					"右键任意消息即可存入思源。内容写入「deepseek对话」笔记本，按日期归入当天日记，每段以时间戳开头。"),
				message !== null
					? h("div", { key: "msg", className: "siy-status", "data-ok": message.ok ? "true" : "false" }, message.text)
					: null,
				h("div", { key: "status", className: "siy-status", "data-ok": statusView.tone }, statusView.text),
				h("div", { key: "rule", className: "siy-status", "data-ok": "pending" },
					"存放位置：" + describeLayout(layout, new Date())),
				// ---- 存放规则 ----
				h("div", { key: "lay", className: "siy-subhead" }, "存放规则"),
				h("div", { key: "lay-nb", className: "siy-field" },
					h("label", { className: "siy-label" }, "目标笔记本"),
					h("input", {
						className: "siy-input",
						type: "text",
						value: layout?.notebook ?? "",
						placeholder: "deepseek对话",
						onChange: (event) => setLayout((prev) => Object.assign({}, prev, { notebook: event.target.value })),
						onBlur: () => saveLayout({ notebook: (layout?.notebook ?? "").trim() || "deepseek对话" }),
					})
				),
				// 日期格式 + 归类方式并排，省纵向空间
				h("div", { key: "lay-grid", className: "siy-grid" },
					h("div", { className: "siy-field" },
						h("label", { className: "siy-label" }, "日期格式"),
						h("select", {
							className: "siy-select",
							value: layout?.dateFormat ?? "dash",
							onChange: (event) => {
								const value = event.target.value;
								setLayout((prev) => Object.assign({}, prev, { dateFormat: value }));
								saveLayout({ dateFormat: value });
							},
						},
							h("option", { value: "dash" }, "2026-10-20"),
							h("option", { value: "slash" }, "2026/10/20"),
							h("option", { value: "cn" }, "2026年10月20日")
						)
					),
					h("div", { className: "siy-field" },
						h("label", { className: "siy-label" }, "归类方式"),
						h("select", {
							className: "siy-select",
							value: layout?.appendMode ?? "same",
							onChange: (event) => {
								const value = event.target.value;
								setLayout((prev) => Object.assign({}, prev, { appendMode: value }));
								saveLayout({ appendMode: value });
							},
						},
							h("option", { value: "same" }, "同一天追加一篇"),
							h("option", { value: "separate" }, "每次新建文档")
						)
					)
				),

				// 时间标题 + 预览开关并排
				h("div", { key: "lay-grid2", className: "siy-grid" },
					h("div", { className: "siy-field" },
						h("label", { className: "siy-label" }, "每段时间标题"),
						h("select", {
							className: "siy-select",
							value: String(layout?.headingLevel ?? 3),
							onChange: (event) => {
								const value = Number(event.target.value);
								setLayout((prev) => Object.assign({}, prev, { headingLevel: value }));
								saveLayout({ headingLevel: value });
							},
						},
							h("option", { value: "0" }, "不添加"),
							h("option", { value: "2" }, "二级标题"),
							h("option", { value: "3" }, "三级标题"),
							h("option", { value: "4" }, "四级标题")
						)
					),
					h("div", { className: "siy-field" },
						h("label", { className: "siy-label" }, "写入前预览"),
						h("select", {
							className: "siy-select",
							value: previewOn ? "on" : "off",
							onChange: (event) => {
								const on = event.target.value === "on";
								setPreviewOn(on);
								controller.setPrefs({ preview: on });
								api("/config", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ preview: on }),
								}).catch(() => {});
							},
						},
							h("option", { value: "on" }, "先预览再写入"),
							h("option", { value: "off" }, "直接写入")
						)
					)
				),
				// 自动标签
				h("div", { key: "lay-tag", className: "siy-field" },
					h("label", { className: "siy-label" }, "自动标签"),
					h("select", {
						className: "siy-select",
						value: layout?.tagging === false ? "off" : "on",
						onChange: (event) => {
							const on = event.target.value === "on";
							setLayout((prev) => Object.assign({}, prev, { tagging: on }));
							saveLayout({ tagging: on });
						},
					},
						h("option", { value: "on" }, "按内容自动加标签"),
						h("option", { value: "off" }, "不加标签")
					),
					h("span", { className: "siy-label", style: { opacity: 0.7 } },
						"命中关键词时会在正文前加 #标签#，方便在思源里聚合检索")
				),
				// 整窗口摘要
				h("div", { key: "lay-summary", className: "siy-field" },
					h("label", { className: "siy-label" }, "整窗口同步时"),
					h("select", {
						className: "siy-select",
						value: summaryPromptOn ? "on" : "off",
						onChange: (event) => {
							const on = event.target.value === "on";
							setSummaryPromptOn(on);
							controller.setPrefs({ summaryPrompt: on });
						},
					},
						h("option", { value: "on" }, "先问是否提取摘要"),
						h("option", { value: "off" }, "直接存全文")
					),
					h("span", { className: "siy-label", style: { opacity: 0.7 } },
						"选「提取摘要」会调用当前模型生成摘要，再连同全文一起存入")
				),
				// 摘要提示词（整窗口同步时使用）
				h("div", { key: "lay-prompt", className: "siy-field" },
					h("label", { className: "siy-label" }, "提取摘要的提示词"),
					h("textarea", {
						className: "siy-prompt-text",
						value: promptText,
						placeholder: "留空则使用内置模板。可以写：你希望摘要包含哪些部分、用什么格式、要不要画图……",
						spellCheck: false,
						onChange: (event) => setPromptText(event.target.value),
						onBlur: (event) => {
							const value = event.target.value;
							api("/config", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ summaryPrompt: value }),
							}).catch(() => {});
						},
					}),
					h("span", { className: "siy-label", style: { opacity: 0.7 } },
						"失焦后自动保存。留空 = 用内置的归档格式模板（概览 / 时间线 / 主要工作 / 关键信息 / 问题与解决 / 后续，必要时自动画流程图）")
				),
				// 重复检测
				h("div", { key: "lay-dedupe", className: "siy-field" },
					h("label", { className: "siy-label" }, "重复内容提醒"),
					h("select", {
						className: "siy-select",
						value: dedupeOn ? "on" : "off",
						onChange: (event) => {
							const on = event.target.value === "on";
							setDedupeOn(on);
							controller.setPrefs({ dedupe: on });
							api("/config", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ dedupe: on }),
							}).catch(() => {});
						},
					},
						h("option", { value: "on" }, "已存过时提示我"),
						h("option", { value: "off" }, "不检查，直接存")
					)
				),
				// 排版：分隔线 / 时间戳
				h("div", { key: "lay-grid3", className: "siy-grid" },
					h("div", { className: "siy-field" },
						h("label", { className: "siy-label" }, "段落之间的分隔线"),
						h("select", {
							className: "siy-select",
							value: layout?.separator === false ? "off" : "on",
							onChange: (event) => {
								const on = event.target.value === "on";
								setLayout((prev) => Object.assign({}, prev, { separator: on }));
								saveLayout({ separator: on });
							},
						},
							h("option", { value: "on" }, "显示（推荐）"),
							h("option", { value: "off" }, "不显示")
						)
					),
					h("div", { className: "siy-field" },
						h("label", { className: "siy-label" }, "每段显示时间戳"),
						h("select", {
							className: "siy-select",
							value: layout?.timeLabel === false ? "off" : "on",
							onChange: (event) => {
								const on = event.target.value === "on";
								setLayout((prev) => Object.assign({}, prev, { timeLabel: on }));
								saveLayout({ timeLabel: on });
							},
						},
							h("option", { value: "on" }, "显示"),
							h("option", { value: "off" }, "不显示")
						)
					)
				),
				// 图表主题：解决夜间模式看不清的问题
				h("div", { key: "lay-mermaid", className: "siy-field" },
					h("label", { className: "siy-label" }, "流程图 / 图表配色"),
					h("select", {
						className: "siy-select",
						value: layout?.mermaidTheme ?? "auto",
						onChange: (event) => {
							const value = event.target.value;
							setLayout((prev) => Object.assign({}, prev, { mermaidTheme: value }));
							saveLayout({ mermaidTheme: value });
						},
					},
						h("option", { value: "auto" }, "跟随思源主题（默认）"),
						h("option", { value: "light" }, "强制浅色 · 白天清晰"),
						h("option", { value: "dark" }, "强制深色 · 夜间清晰"),
						h("option", { value: "high" }, "高对比 · 深浅背景都清晰")
					),
					h("span", { className: "siy-label", style: { opacity: 0.7 } },
						"夜间模式下图表看不清时，试试「强制深色」或「高对比」。已有的旧图表需重新同步才生效。")
				),

				// ---- 待写入队列 ----
				pending > 0
					? h("div", { key: "q-head", className: "siy-subhead" }, "待写入（" + String(pending) + " 条）")
					: null,
				queueEntries.map((entry) => h("div", { key: "q-" + entry.id, className: "siy-queue-row" },
					h("div", { className: "siy-queue-meta" },
						h("div", { className: "siy-queue-title" },
							(entry.title || "未命名") + " · " + String(entry.bytes ?? 0) + " 字"),
						h("div", { className: "siy-queue-sub" },
							formatWhen(entry.createdAt) +
							(entry.attempts > 0 ? " · 已重试 " + String(entry.attempts) + " 次" : "") +
							(entry.lastError ? " · " + String(entry.lastError) : ""))
					),
					h("button", {
						type: "button",
						className: "siy-mini",
						disabled: !ready || busyId !== null,
						onClick: () => queueAction("retry", entry.id),
						children: busyId === entry.id + ":retry" ? "…" : "重试",
					}),
					h("button", {
						type: "button",
						className: "siy-mini",
						"data-danger": "true",
						disabled: busyId !== null,
						onClick: () => queueAction("remove", entry.id),
						children: busyId === entry.id + ":remove" ? "…" : "删除",
					})
				)),
				h("div", { key: "actions", className: "siy-row" },
					h("button", {
						type: "button",
						className: "siy-btn",
						disabled: busy,
						onClick: rescan,
						children: busy ? "检测中…" : "重新检测",
					}),
					h("button", {
						type: "button",
						className: "siy-btn",
						disabled: busy || !ready || pending === 0,
						onClick: flushQueue,
						children: busy ? "处理中…" : (pending > 0 ? "立即写入 " + String(pending) + " 条" : "队列为空"),
					}),
					h("span", { className: "siy-spacer" }),
					embedded === true
						? null
						: h("button", { type: "button", className: "siy-btn siy-btn-primary", onClick: () => controller.closeDialog(), children: "完成" })
				),
			]);
		}

		//#region ---------- 会话覆盖层 ----------
		function Overlay({ controller }) {
			const pair = React.useState(0);
			const force = pair[1];
			React.useEffect(() => controller.subscribe(() => force((value) => value + 1)), [controller]);
			const state = controller.getState();
			return h(React.Fragment, null,
				h(ContextMenu, { menu: state.menu, controller: controller }),
				state.dialog ? h(SettingsDialog, { controller: controller }) : null,
				state.preview !== null ? h(PreviewDialog, { preview: state.preview, controller: controller }) : null,
				state.duplicate !== null ? h(DuplicatePrompt, { duplicate: state.duplicate, controller: controller }) : null,
				state.summaryChoice !== null
					? h(SummaryChoice, { choice: state.summaryChoice, busy: state.summaryBusy === true, controller: controller })
					: null,
				state.toast !== null
					? h("div", { className: "siy-toast", "data-error": state.toast.error ? "true" : "false" }, state.toast.text)
					: null
			);
		}

		//#region ---------- 消息动作按钮 ----------
		function SyncAction({ messageId, controller }) {
			void messageId;
			const pair = React.useState(false);
			const busy = pair[0];
			const setBusy = pair[1];
			const onClick = React.useCallback((event) => {
				try {
					// 按住 Shift 点图标 = 同步整个窗口；直接点 = 同步本轮。
					if (event.shiftKey === true) {
						setBusy(true);
						controller.syncWindow();
						window.setTimeout(() => setBusy(false), 900);
						return;
					}
					const node = event.currentTarget;
					const tail = node.closest("[data-turn-tail]");
					const turn = tail !== null ? tail.getAttribute("data-turn-tail") : null;
					if (turn === null) {
						controller.openDialog();
						return;
					}
					setBusy(true);
					controller.syncTurn(turn);
					window.setTimeout(() => setBusy(false), 900);
				} catch (error) { void error; }
			}, [controller, setBusy]);
			return h("button", {
				type: "button",
				title: "同步本轮到思源（按住 Shift 同步整个窗口）",
				"aria-label": "同步到思源笔记",
				"data-siy-ui": "",
				onClick: onClick,
				disabled: busy,
				style: {
					width: "28px", height: "28px", padding: "6px", border: "0", borderRadius: "6px",
					cursor: "pointer", background: "transparent", color: "inherit",
					display: "inline-flex", alignItems: "center", justifyContent: "center",
				},
			}, h("svg", { width: 15, height: 15, viewBox: "0 0 16 16", "aria-hidden": "true" },
				h("path", {
					d: "M3 2.5h6.2L13 6.3V13a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 13V2.5Z",
					fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinejoin: "round",
				}),
				h("path", {
					d: "M8.5 9.6V5.4m0 4.2L6.7 7.8m1.8 1.8 1.8-1.8",
					fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round",
				})
			));
		}

		//#region ---------- 插件管理中的控制面板 ----------
		/**
		 * 在「设置 → 插件」里注册一个名为 dsh-siyuan 的条目。
		 * summary 视图是卡片上的一行摘要；page 视图是完整控制面板。
		 */
		function PluginPanel({ view, controller }) {
			if (view === "summary") {
				return h("span", { className: "siy-summary" }, "把对话一键存进思源笔记，思源没开也能先暂存");
			}
			return h(SettingsDialog, { controller: controller, embedded: true });
		}

		//#region ---------- 插件本体 ----------
		const inject = ["slots"];

		function apply(ctx) {
			try {
				injectCss();

				// 调试入口：在浏览器控制台执行 dshSiyuan.debugCodeBlocks()，
				// 会打印所有代码块的真实 DOM 结构，便于定位语言标记的位置。
				if (typeof globalThis !== "undefined") {
					globalThis.dshSiyuan = {
						debugCodeBlocks() {
							const pres = Array.from(document.querySelectorAll("pre")).slice(0, 5);
							return pres.map((pre) => ({
								outerClass: pre.className,
								attrs: Array.from(pre.attributes).map((a) => a.name + "=" + a.value),
								parentClass: pre.parentElement ? pre.parentElement.className : null,
								parentAttrs: pre.parentElement ? Array.from(pre.parentElement.attributes).map((a) => a.name + "=" + a.value) : [],
								codeClass: pre.querySelector("code") ? pre.querySelector("code").className : null,
								detected: codeLanguage(pre),
								htmlHead: (pre.outerHTML || "").slice(0, 300),
							}));
						},
					};
				}

				// 全局只有一个控制器：整个页面一份右键菜单、一个设置面板、一个 toast。
				const controller = createController("global");

				const onContextMenu = (event) => {
					try {
						if (event.defaultPrevented) return;
						const target = event.target;
						if (!(target instanceof Element)) return;
						const row = target.closest("[data-chat-flow-key]");
						if (row === null) return;
						const anchor = row.closest("[data-chat-turn]");
						const turn = row.getAttribute("data-chat-turn") ?? (anchor !== null ? anchor.getAttribute("data-chat-turn") : null);
						event.preventDefault();
						controller.openMenu({ x: event.clientX, y: event.clientY, row: row, turn: turn });
					} catch (error) { void error; }
				};
				document.addEventListener("contextmenu", onContextMenu, true);

				ctx.effect(() => () => {
					document.removeEventListener("contextmenu", onContextMenu, true);
					controller.dispose();
				}, "dsh-siyuan-sync: lifecycle");

				ctx.slots.inject("shell.overlay", () => ctx.slots.register({
					name: "shell.overlay",
					id: "siyuan-sync-overlay",
					inject: () => ({ controller: controller }),
				}, Overlay));

				ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
					name: "conversation.chat.assistant-actions",
					id: "siyuan-sync-action",
					order: 40,
					inject: () => ({ controller: controller }),
				}, SyncAction));

				// 「设置 → 插件 → dsh-siyuan」里的控制面板。
				ctx.slots.inject("plugins.item", () => ctx.slots.register({
					name: "plugins.item",
					id: "dsh-siyuan",
					label: () => "dsh-siyuan",
					order: 90,
					inject: () => ({ controller: controller }),
				}, PluginPanel));
			} catch (error) {
				try { console.warn("[dsh-siyuan-sync] client apply failed:", error); } catch (inner) { void inner; }
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		// 仅测试环境暴露纯函数，避免复制实现导致验证失真。
		if (globalThis.__DSH_SIYUAN_TEST__ === true) {
			exports.__test = {
				serializeRow: serializeRow,
				serializeWindow: serializeWindow,
				tidy: tidy,
				documentTitle: documentTitle,
				kindOf: kindOf,
				speakerBlock: speakerBlock,
				codeLanguage: codeLanguage,
				codeText: codeText,
			};
		}
		return module.exports;
	}
});