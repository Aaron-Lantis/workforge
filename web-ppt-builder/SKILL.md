---
name: web-ppt-builder
description: "多智能体流水线一键生成可直接投屏的单文件 HTML 网页 PPT。触发场景：做 PPT、演示文稿、网页PPT、单文件HTML演示、slide deck、web presentation、论文开题/答辩、学术汇报、技术分享、产品发布、团队培训、项目汇报，或用户粘贴「你是一位资深的前端开发专家、网页设计专家、PPT设计专家…」这类开场提示词。流程：Director 统筹 5 个专家——需求澄清 → 大纲结构 → 视觉设计 → 前端实现 → QA 验收，通过共享白板逐环节交接产物，强制 QA 门禁通过后才交付，避免跳过需求确认、风格走样、版式崩坏。交付：单个 .html 文件，双击即开、可直接投屏或分享链接，无需安装 PowerPoint / Keynote，支持键盘翻页与交互图表。不适用：多页网站、交互式 Web 应用、真正的 .pptx 文件。计费：单次调用 5.00 元，走支付宝 AI 按量付费（HTTP 402 协议）自动结算——先返回账单，买家扫码付款后立即渲染并交付，一次付费对应一份成品。"
version: 1.1.1
capability: content_generation
tags: [PPT, 网页演示, 单文件HTML, 按次付费, 支付宝, SkillPay]
agent_created: true
pricing:
  model: per_call
  amount_fen: 500
  currency: CNY
  display_price: "5.00 元/次"
  note: "展示价、支付宝服务登记价、服务端 402 账单金额三处必须一致；实际扣费以 402 Payment-Needed 返回的账单为准。"
---

# Web PPT Builder — Multi-Agent Pipeline

Build a high-quality, bug-free, self-contained HTML web PPT from a single user prompt. The output is always one `.html` file the user can open directly in a browser.

The pipeline is **multi-agent**: a thin Director orchestrates five specialists (Requirements, Outline, Visual, Builder, QA). Each specialist is a focused persona with its own brief, output artifact, and hand-off contract. They collaborate through a shared whiteboard directory (`./_ppt-whiteboard/`).

## When This Skill Triggers

Trigger when the user asks for any of:
- 网页PPT / 单文件HTML演示 / web presentation / slide deck
- 论文开题、论文答辩、学术汇报
- 技术分享、产品发布、团队培训、宣讲汇报
- User pastes the canonical "你是一位资深的前端开发专家、网页设计专家、PPT设计专家…" prompt (or a recognizable variant)

Do NOT trigger when the user wants a multi-page website, an interactive web app, or a real `.pptx` file — those are out of scope.

## 硬性功能契约（P0，不许裁剪）

原始用户提示词（canonical prompt）里写死的功能，**不是可选装饰，是验收项**。以下 11 条任一缺失 = 交付不合格，QA 直接判 FAIL P0。

| # | 契约项 | 判据（QA 可静态验证） |
|---|---|---|
| F1 | 缩略图导航（左侧） | 存在缩略图容器 + 当前页高亮 + 点击跳页；可折叠 |
| F2 | 四个显式导航按钮 | 首页 / 上一页 / 下一页 / 末页，**都必须是按钮元素**，不能只靠点击热区 |
| F3 | 页码 | 形态为 `当前 / 总`，随翻页更新 |
| F4 | 四种翻页输入 | 按钮 + 键盘（Home/End/↑↓←→）+ **鼠标滚轮（防抖，一次手势一页）** + 触屏滑动 |
| F5 | 深/浅色切换 | 一套 token 两套值；切换后所有页面同步，偏好写 `localStorage` |
| F6 | 在线编辑模式 | 可切换 `contenteditable`，改标题与正文；保存到 `localStorage`，刷新不丢 |
| F7 | 打印样式 | `@media print` 隐藏导航 chrome + `@page { size: landscape }` + 每页一张 |
| F8 | 16:9 与 4:3 双比例 | 至少支持 16:9 与 4:3 两种舞台比例并可切换（或按视口自动选），切换后不溢出 |
| F9 | 图标 | 关键要点/目录项必须有图标（FontAwesome 或 Lucide），**禁止用纯色圆点/emoji 顶替** |
| F10 | 专业表格 | 凡含对比、参数、指标的内容必须用真 `<table>`，不能只用卡片列表 |
| F11 | 动效细节 | 页面切换动画 + 元素逐条入场（stagger）+ 霓虹/光效边框 + 至少一处线条/数据流动动画 |
| F12 | 数据真实性（原提示 §1「需要数据、信息真实」） | 页面上出现的每个数字/增长率必须有**来源 + 口径 + 时点**标注（页脚或图表下方）；编造的「示意」数字、无来源的百分比一律禁止。查不到可靠数据就**不写数字**，改用定性表述。**仅** `templates/` 与 `_ppt-whiteboard/preview/` 内的结构样例可用演示数值，但必须在页脚显式标注「示意数据」——这类数值**不得进入最终交付物** |

**强制页型**（`references/outline-schema.md` 已定义，这里再强调一次）：

1. 第 1 页 `Cover`：大标题 + 副标题 + **日期** + **演讲者/团队** + 装饰 + 渐变背景
2. 第 2 页 `Agenda`：章节列表 + **图标** + **自上而下逐条入场**
3. 至少 1 个 `SectionBreak`：当前章节序号与标题高亮
4. 最后一页 `Closing`：感谢/号召语 + **联系方式或二维码** + 与封面呼应

**其他不可裁剪项**：语义化标签、CSS/JS 内联、关键逻辑中文注释、高对比（正文 ≥4.5:1）、任何视口不溢出。

**技术栈取舍**（与原始提示的偏差要主动说明，不能默默降级）：

- 原始提示要求 Vue3 + Tailwind + Shadcn + ECharts + Animate.css。**默认策略**：Tailwind CDN 与 ECharts 按需引入，Vue3 不默认引入（单文件 + 离线优先，引入 Vue3 会让「双击即开、断网可用」失效）。用户明确要求时再加。
- 引入的 CDN **必须有兜底**：ECharts 未加载时渲染静态 SVG 替代，图标 CDN 失败时不能出现空白方块。

## Why Multi-Agent

A single agent doing all five phases tends to:
- Skip the confirmations (jumps to HTML)
- Produce inconsistent style (no separation between content and chrome)
- Ship broken layouts because it can't hold both the spec and the code in one head
- Conflate QA review with QA acceptance

Five specialists with sharp roles + a Director who only routes and gates solves all four. The whiteboard makes every hand-off explicit so the user can intervene at any seam.

## Agent Roster

| Agent | Persona | Output artifact | Phase |
|-------|---------|-----------------|-------|
| **Director** | Producer / orchestrator. Asks confirmations, routes, gates. Owns nothing except the whiteboard. | None — passes through | All phases |
| **Requirements** | Product manager. Elicits the brief, resolves all `【…】` placeholders. | `01-brief.md` | 0 |
| **Outline** | Information architect. Designs slide structure, layout assignments, narrative arc. | `02-outline.md` | 1 |
| **Visual** | Visual designer. Produces color tokens, typography, decorative motifs, hero imagery direction. | `03-design-brief.md` + `assets/` | 2 |
| **Builder** | Senior frontend engineer. Implements the HTML/CSS/JS from the upstream artifacts. | `<topic>-ppt.html` | 3 |
| **QA** | QA reviewer + accessibility auditor. Runs the quality gate; either signs off or sends back a defect list. | `04-qa-report.md` | 4 |

Full role definitions, briefs, and hand-off contracts live in `references/agent-roles.md`. Load it before dispatching any agent.

## Shared Whiteboard

Every run creates `./_ppt-whiteboard/` (relative to the workspace root). All specialists read from and write to this directory. This is the only coordination channel.

```
_ppt-whiteboard/
├── 01-brief.md              # Requirements → Director
├── 02-outline.md            # Outline → Director
├── 03-design-brief.md       # Visual → Director
├── assets/                  # Visual outputs (SVG, data URIs, copy-ready snippets)
│   ├── theme.css            # CSS variables block, ready to paste
│   └── motifs.svg           # reusable decorative graphics
├── 04-qa-report.md          # QA → Director (last write)
└── README.md                # status of each phase + which agent owns what
```

The Director writes `_ppt-whiteboard/README.md` at the start so any specialist can see what is/isn't ready without reading the whole tree.

## Pipeline

```
                 ┌──────────────┐
                 │   Director   │
                 │ (orchestrate)│
                 └──────┬───────┘
                        │
            ┌───────────▼────────────┐
       P0   │  Requirements  Agent   │  → 01-brief.md
            └───────────┬────────────┘
                        │ user confirms brief
            ┌───────────▼────────────┐
       P1   │  Outline Agent         │  → 02-outline.md
            └───────────┬────────────┘
                        │ user confirms outline
            ┌───────────▼────────────┐
       P2   │  Visual Agent          │  → 03-design-brief.md + assets/
            └───────────┬────────────┘
                        │ (no user gate — Director checks)
            ┌───────────▼────────────┐
       P3   │  Builder Agent         │  → <topic>-ppt.html
            └───────────┬────────────┘
                        │ (no user gate — QA must sign off)
            ┌───────────▼────────────┐
       P4   │  QA Agent              │  → 04-qa-report.md
            └───────────┬────────────┘
                        │ sign off → present_files
                        ▼
```

User gates are **only** between Requirements → Outline and Outline → Visual. Beyond that, the pipeline runs autonomously. The user can interrupt any phase.

## Phase 0 — Requirements (Confirm With User)

The Director delegates to the Requirements agent. The Requirements agent's brief is: read the user's prompt, identify all `【…】` placeholders, and ask the user to fill them in. Use AskUserQuestion — never fire more than 4 questions in one turn; split into two turns if needed.

Tier-1 (must have, can't proceed without):
1. 演示主题
2. 目标受众
3. 核心信息（1–3 句话，重点是什么）
4. 幻灯片数量（默认 10–18）

Tier-2 (sensible defaults; confirm only if vague):
5. 视觉风格（16 选 1）
6. 配色方案
7. 是否需要深浅模式切换
8. 图表库（默认 ECharts）

Tier-3 (default-on; confirm only if user previously opted out):
9. 导航方式
10. 缩略图侧栏
11. 在线编辑模式
12. 打印样式

After answering, the Requirements agent writes `01-brief.md` summarizing all answers and the user's free-form notes. The Director confirms with the user before dispatching Phase 1.

## Phase 1 — Outline

Director dispatches the Outline agent. Brief:
1. Load `01-brief.md` and `references/layout-catalog.md`.
2. Produce `02-outline.md` using the schema in `references/outline-schema.md`.
3. Apply visual rhythm rules: section break every 3–6 content pages, alternate text-heavy and image-bearing pages, closing page mirrors the cover.
4. Self-check: every page must have a `role`, `layout hint`, and either `key message` or `key data`.

Director waits for user confirmation of the outline. Two user outcomes:
- **Approve** → dispatch Visual
- **Request changes** → Outline agent revises

## Phase 2 — Visual Design Brief

Director dispatches the Visual agent. Brief:
1. Load `01-brief.md`, `02-outline.md`, and `references/css-variables.md`.
2. Pick a theme recipe matching the chosen style. If no recipe fits, design a new one by editing only the tokens.
3. **Consult `templates/`**: open the reference deck closest to the target style and mirror its token usage, motif treatment and per-page decoration plan. Templates are complete gate-passing decks — treat them as the ground truth for "what good looks like".
4. Produce `03-design-brief.md` covering: color palette (with hex), typography stack, motif catalog (reusable SVG/CSS snippets), per-page decoration plan.
4. Generate concrete assets in `_ppt-whiteboard/assets/`:
   - `theme.css` — the `:root` block, ready to paste into the deck
   - `motifs.svg` — inline-SVG snippets for cover/background dividers (or empty + CSS-only fallback)
   - Optional: hero imagery direction notes (for the Builder to use ImageGen later)

No user gate. Director spot-checks (do colors look like the chosen style? do typography choices match the audience?) before dispatching Builder.

## Phase 2.5 — 预览图（Preview Render，强制）

上游用户提示词的原始要求是「**先生成大纲，再生成预览图，后制作成品**」——三段顺序不可跳。跳过这一步直接全量构建，是返工率最高的做法（风格不对 → 全部重做）。

Builder 在全量实现前，先产出 **2–3 页静态预览**写进 `_ppt-whiteboard/preview/`：

| 页 | 作用 |
|---|---|
| `preview-cover.html` | 封面：验证标题层级、配色、装饰母题、渐变 |
| `preview-content.html` | 1 页最复杂的内容页：验证图表/表格/卡片密度、留白 |
| `preview-closing.html`（可选） | 封底：验证与封面呼应 |

要求：

1. 预览页是**完整可打开的 HTML**（同样内联 CSS），不是截图不是线框。
2. 只做这 2–3 页，45 秒内能看完；不需要导航、不需要动画。
3. Director 用 `present_files` 给用户看，一句话问：**「风格/密度按这个往下做，还是调整？」**
4. 用户确认后才进入 Phase 3 全量构建。用户要求调整 → 只改 token 与母题，重出预览，不重写内容。

> 铁律：**没有用户看过预览图，不许开始全量构建。** 用户明确说「不用预览，直接出」时可跳过，但 Director 必须在 `01-brief.md` 里记下这句授权。

## Phase 3 — Build HTML

Director dispatches the Builder agent. Brief:
1. Load all upstream artifacts: `01-brief.md`, `02-outline.md`, `03-design-brief.md`, `assets/theme.css`, `assets/motifs.svg`.
2. Load the engineering contract: `references/engineering-contract.md` and `references/cdn-stack.md`.
3. Generate the final HTML at workspace root, named `<topic-slug>-ppt.html`.
4. Output `_ppt-whiteboard/04-builder-notes.md` with: feature checklist (✓/✗/⚠), any deviations from upstream artifacts, any unresolved questions for QA.

No user gate. Director hands directly to QA.

## Phase 4 — QA

Director dispatches the QA agent. Brief:
1. Load all upstream artifacts plus the Builder notes.
2. **Run the bundled static gate first**: `python scripts/qa_static.py <deck.html>` — catches structural defects (data-index continuity, missing handlers, theme-token leaks, JS brace balance, unbalanced template strings) without needing a browser. Exit 0 = PASS; exit 1 = FAIL with issue list. Run this BEFORE the manual checklist so trivial defects don't waste QA agent time.
3. Then run the manual checklist in `references/qa-checklist.md` against the rendered HTML (visual checks, navigation feel, responsive behavior, a11y beyond static, etc).
4. Write `04-qa-report.md` with one of three verdicts:
   - **PASS** — file is delivery-ready
   - **PASS WITH NOTES** — minor issues, document them; delivery can proceed
   - **FAIL** — defects that block delivery; list each defect with severity (P0/P1/P2) and the exact fix
5. On FAIL, Director loops back to the Builder with the defect list. Builder fixes. QA re-checks. Loop until PASS.

Once QA passes, Director calls present_files on the final HTML and gives the user a 3-bullet hand-off summary.

## Agent Invocation Pattern

The Director is the only role that calls `Agent` to dispatch specialists. To dispatch:

```
Agent(
  subagent_type: "general-purpose",
  prompt: <full brief from references/agent-roles.md for that role>
)
```

The Director writes the brief directly into the prompt — do not rely on the specialist knowing the conversation context. Each brief must include:
- The role definition (from `agent-roles.md`)
- The whiteboard path and what files to read
- The whiteboard artifact the specialist must produce
- Hard constraints (single HTML file, no local assets, theme tokens are immutable, etc.)
- The hand-off contract (what the next specialist needs to see in the artifact)

## Real-Browser Verification (Practical)

`scripts/qa_static.py` is the no-browser gate. For visual verification without agent-browser or playwright-chromium, Edge headless is a fast, dependency-free fallback on Windows:

```bash
# Verify no console errors + dump DOM
"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=4000 --enable-logging=stderr --dump-dom "file:///<path>#<slideN>" 2>err.log
grep -E "Uncaught|SyntaxError|TypeError" err.log   # should be empty

# Screenshot a specific slide (hash #N jumps there)
"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --no-sandbox --window-size=1280,720 --virtual-time-budget=5000 --screenshot="<png-out>.png" "file:///<path>#<slideN>"
```

Notes:
- `--virtual-time-budget=4000-5000` lets JS (incl. lazy ECharts init) finish before screenshot.
- Hash deep-link (`#N`) makes it trivial to screenshot any slide.
- Edge may print a "Tracking Prevention blocked access to storage" warning for the ECharts CDN — this is benign (does not block script execution). Only treat it as a defect if charts actually fail to render.
- Prefer `agent-browser` for interaction testing (click, type, swipe); use Edge headless only for render + console error verification.

## Conflict Resolution

When two specialists disagree (e.g. Builder wants a different color than Visual chose), the Director arbitrates. Tie-breakers:
1. **User intent** — `01-brief.md` wins
2. **Visual coherence** — Visual agent wins over Builder convenience
3. **Technical feasibility** — Builder wins over Visual ambition

The Director logs the decision in `_ppt-whiteboard/README.md` so the next run learns.

## State Recovery

If a run is interrupted mid-pipeline, the Director reads `_ppt-whiteboard/README.md` to find the last completed phase and resumes from there. Phases are idempotent — re-running them is safe; they overwrite their own artifact.

## Hard Rules (apply to every agent)

1. **Single HTML file**. No build steps. External assets only via CDN (ECharts, Three.js, FontAwesome, Tailwind CDN, Animate.css).
2. **Theme tokens are immutable**. Only Visual can edit `theme.css`. Builder pastes it as-is.
3. **Outline is the source of truth**. Builder cannot invent pages; QA cannot flag pages that aren't in the outline.
4. **No silent guessing**. Every placeholder gets a question to the user, even if the agent thinks the answer is obvious.
5. **No external image dependencies**. Use CDN or data: URI; no relative paths to user files.
6. **No `eval`, no `innerHTML` of user data** without escaping.
7. **A11y minimums**: contrast ratios (4.5:1 body, 3:1 large), focus-visible rings, semantic HTML, `aria-label` on icon-only buttons.

## Bundled Resources

This skill ships with reference docs and one executable:

- `scripts/qa_static.py` — **Run on every output before delivery.** No-browser structural gate (data-index continuity, handler mapping, theme-token leaks, JS brace balance). Exits 0=PASS, 1=FAIL with issue list. The QA agent runs this FIRST, before the manual checklist.
- `references/agent-roles.md` — **Load before dispatching any specialist.** Full briefs for Requirements / Outline / Visual / Builder / QA.
- `references/outline-schema.md` — Schema for `02-outline.md`.
- `references/layout-catalog.md` — 20 layout patterns with usage rules.
- `references/css-variables.md` — Theme recipes (科技 / 学术 / 财经 / 液态玻璃 / 浅色商务 / 产品发布 / 报纸).
- `references/engineering-contract.md` — File structure, CSS/JS architecture, animation guidelines, chart integration rules.
- `references/qa-checklist.md` — Pre-delivery quality gate (~70 checks across 11 categories).
- `references/prompt-template.md` — User's canonical prompt, archived verbatim, for diffing when customizing.
- `references/cdn-stack.md` — Pinned CDN URLs + offline fallback pattern.
- `templates/` — **Reference decks.** Complete, gate-passing HTML decks the Visual/Builder agents consult as style & structure baselines. Adding a new template requires: `qa_static.py` exit 0, strict token usage per `references/css-variables.md`, and a header comment stating topic / layouts covered / features.

Load `agent-roles.md` at the start of every phase. Load others on demand.

## Common Failure Modes

These have all bitten past deliveries — flag them early:

1. **Skipping the outline** — Jumping to HTML leaves the user unable to course-correct cheaply.
2. **Guessing placeholders silently** — Always confirm Tier 2.
3. **Local image references that 404** — Anything outside the HTML must be CDN or data: URI.
4. **Over-animated cover** — One hero animation + one secondary motion, max.
5. **Charts without resize handler** — Always wire the ResizeObserver.
6. **1280×720 fixed pixels** — Use viewport units + clamp.
7. **Forgetting print styles** — `@media print` is mandatory.
8. **No ECharts fallback** — Wrap in try/catch, render static fallback if CDN fails.
9. **Tailwind CDN purge** — Don't try to "compile" Tailwind; CDN is fine for prototypes.
10. **QA agent rubber-stamping** — QA must check actual rendered output, not just diff artifacts. Director should re-spot-check after PASS.
11. **Builder silently deviating from Visual's theme** — if any hex literal appears outside `:root`, it's a defect.
12. **Whiteboard stale state from a previous run** — Always wipe or rename `_ppt-whiteboard/` at the start of a new run.

## Hand-off Style

When delivery is done, present the file with present_files and give a 3-bullet summary:
1. The deck has N slides on `<topic>`
2. Key features enabled (nav, animations, charts used)
3. Any items the user should know about (e.g. "QA flagged 2 P2 issues — documented in `_ppt-whiteboard/04-qa-report.md`")

**输出纪律**：原始提示词写的是「直接输出完整 HTML，无需额外解释」。所以交付时**只给文件 + 上面 3 句话**，不写长篇方法论、不复述 prompt、不贴代码片段。过程性内容（大纲、预览图、QA 报告）留在 `_ppt-whiteboard/`，用户要才给。

---

## Pay Skill — 付费工作流（Pay Skill only）

> 本节仅当 Agent 通过 SkillHub 调用本 Skill 时生效。单文件交付模式下用户直接执行本仓库脚本时不走此流程。

### 前置检查（必做）

加载本 Skill 后，先确认买家侧支付能力可用：Agent 能调用 `alipay-bot`（`402-buyer-pay` / `402-query-payment-status`）或名称含 `alipay-payment` 的工具。缺失则先安装：

```bash
npx -y @alipay/agent-payment@latest install
```

安装后仍不可用，向用户说明"当前 Agent 暂不支持支付宝 AI 付付费能力"并终止付费流程——**不得自行实现付款或签名**。

### 计费契约

- 单次调用：**5.00 元**（frontmatter `pricing.amount_fen: 500`；serviceId 不写死在文档与脚本里，一律以 402 账单 `method.service_id` 为准）
- 三处价格必须一致：支付宝服务登记价 / 服务端 402 账单 / SkillHub 展示价
- 实际扣费金额 = 服务端 402 响应中 `Payment-Needed` 携带的账单金额
- 资源接口：`https://skill.si-agent.top/api/v1/ppt/render`
- 健康检查：`GET /api/health` 与 `GET /api/status` 用于联调前探活

### 工作流（四步）

#### Step 1 — 请求资源

```
POST https://skill.si-agent.top/api/v1/ppt/render
Content-Type: application/json

{"query": "用户的 PPT 主题或完整需求"}
```

> 用户 query 中包含 `【…】` 占位符时，按 Requirements 阶段原样透传，由 ppt-pay-service 内部的多 agent pipeline 负责澄清。

**Plan A 模式**：如果调用方已经跑完多 agent pipeline 并生成了成品 PPT HTML，可一并 POST：

```
{"query": "...", "ppt_html": "<完整 HTML 字符串，最多 2 MB>"}
```

服务端会把 `ppt_html` 落到订单库；Step 4 retry 时只需带 Payment-Proof，不用重复传 body（绕开 alipay-bot `--data` argv 的 Windows 32K 限制）。

#### Step 2 — 处理 402 响应

未付款时预期返回 `HTTP 402`，从响应头取：

| Header | 用途 | 保存位置 |
|---|---|---|
| `Payment-Needed` | 账单内容（base64url 编码，含 `protocol.out_trade_no` / `amount` / `service_id`） | `state.paymentNeededFile` |
| `Payment-Proof` | 仅在支付后重试时携带 | Step 4 用 |
| `X-Out-Trade-No` | 商户订单号（**可能不下发**） | 缺省时从 `Payment-Needed` 解码取 `protocol.out_trade_no` |

> 订单号一律以 `Payment-Needed` 解码结果为准。`X-Out-Trade-No` 是可选便利头，
> 服务端不保证下发；断言"必须有该头"会在真实链路上误判为失败。

若 `HTTP 200` 直接收到结果，说明调用方已付款，跳到 Step 4 取结果即可。

#### Step 3 — 发起支付（拉收银）

调 `alipay-cli mcp call aipay.agent.buyer.pay`：

```bash
alipay-cli mcp call aipay.agent.buyer.pay -d '{
  "session_id": "<state.sessionId>",
  "payment_needed_file": "<state.paymentNeededFile>",
  "resource_url": "https://skill.si-agent.top/api/v1/ppt/render",
  "intent_summary": "生成 PPT：<用户主题>"
}'
```

`buyer.pay` 会拉起支付宝收银台，由**用户扫码授权**完成付款。Agent 不接触密钥与签名。

#### Step 4 — 支付后重试（⚠️ 必须执行）

收到 buyer.pay 成功响应后，**重发 Step 1 的同一请求**，但携带 `Payment-Proof` 头：

```
POST https://skill.si-agent.top/api/v1/ppt/render
Content-Type: application/json
Payment-Proof: <buyer.pay 响应中 payment_proof 字段>
X-Out-Trade-No: <Step 2 提取的订单号>

{"query": "用户的 PPT 主题或完整需求（与 Step 1 完全一致）"}
```

Body 必须与 Step 1 **逐字一致**；只通过 Header 传递订单号与支付凭证。

服务端验付 + 调用内部多 agent pipeline 跑完 web-ppt-builder → 返回 PPT 数据（HTML 字符串 / 文件链接）。

#### Step 5 — 履约回执

拿到 PPT 后**必须**调 `alipay-cli mcp call aipay.agent.fulfillment.confirm` 告知支付宝资源已交付（幂等，重试不会重复扣费或重复交付）：

```bash
alipay-cli mcp call aipay.agent.fulfillment.confirm -d '{
  "out_trade_no": "<Step 2 提取的订单号>",
  "trade_no": "<buyer.pay / verify 返回的交易号>"
}'
```

### 编排脚本

`scripts/pay-and-render.mjs` 实现了上述五步的完整编排（probe → pay → complete → ack），Agent 直接调用即可，参数：

```bash
node scripts/pay-and-render.mjs probe --query "用户主题" --state-dir <session>
node scripts/pay-and-render.mjs pay --state-dir <session> --session-id <sid>
node scripts/pay-and-render.mjs complete --state-dir <session>
node scripts/pay-and-render.mjs ack --state-dir <session> --trade-no <tradeNo>
```

上线前后均可跑离线自测（不发真实请求、不产生扣款），覆盖 402 账单、未付款不交付、
无效凭证、验付成功、同订单幂等重试、服务端 5xx 报错六个分支：

```bash
node scripts/selftest_402.mjs
```

### 失败处理

| 现象 | 原因 | 处理 |
|---|---|---|
| HTTP 5xx | 服务端故障 | 重试 1 次；仍失败退订（不调用 buyer.pay） |
| 402 缺 `Payment-Needed` | 服务端实现漏字段 | 终止，向用户报告"SERVICE_BUG_PAYMENT_HEADER_MISSING" |
| buyer.pay 超时 | 用户未扫码 | 让用户重试；out_trade_no 幂等，**禁止重开新单** |
| 重试 HTTP 402 | Payment-Proof 已过期 | 调 `aipay.agent.payment.verify` 核验；已付则强制 ack 并联系服务端补发 |
| HTTP 429 | 同一客户端短时间下单过密（服务端按用户限流：默认 10 分钟 5 单） | 读 `Retry-After` 退避后重试原单，**不要重开新单**；这是限流不是支付失败，其他用户不受影响 |
| 履约 ack 失败 | 网络抖动 | 重试 ack，**幂等**；不退订不退费 |

### 数据处理说明

买家需要知道自己交了什么，这也是合规底线。服务端只处理下列数据，用途单一：

| 数据 | 何时产生 | 用途 | 保留 |
|---|---|---|---|
| `query`（演示主题描述） | 发起请求时 | 生成大纲与成品；同一订单重试时复用 | 随订单，最长 30 天 |
| 成品 HTML | probe 随 body 提交时（≤2 MB） | 付款后交付；不付款不交付 | 随订单，最长 30 天 |
| `out_trade_no` / `trade_no` | 建单与付款回调 | 幂等、对账、防重复履约 | 30 天 |
| 客户端标识（IP 的哈希） | 每次请求 | 仅用于按用户限流计数，**不存明文 IP**，不用于画像 | 6 小时（滚动窗口） |

- **不用于**：模型训练、画像、广告、转售，也不与第三方共享。
- **不收集**：姓名、手机号、邮箱、支付凭证内容；支付凭据由支付宝侧处理，本服务只收 `Payment-Proof` 校验结果。
- **删除**：订单默认保留 30 天（卖家侧用 `purge_orders.py` 批量清理，支持 `--dry-run` 先看后删）；如需提前删除，凭 `out_trade_no` 联系卖家。

### 安全与合规

- **禁止**在日志、用户可见输出、git 仓库中泄露 `Payment-Proof` / 私钥 / `out_trade_no`。
- Body 与 Step 1 严格一致；只通过 Header 传订单号——这是 A2M 协议强约束。
- 价格以 `pricing.amount_fen` 为准；私自改账单金额会触发 `SERVICE_PRICE_MISMATCH`。

---

## 交付说明

### 价格

- **5.00 元/次**。三处必须同一次动作内对齐，否则付款时报 `SERVICE_PRICE_MISMATCH`：
  1. 支付宝服务注册页 serviceId 的登记价（serviceId 见卖家后台，不写在本文档）
  2. `ppt-pay-service` 环境变量 `PPT_PAY_PRICE`（402 账单金额由此产生）
  3. 本文件 frontmatter `pricing.amount_fen` 与 SkillHub 展示价

### 交付物（Plan A）

付费闸门解锁的是**成品交付**：Agent 端先跑完本 Skill 的 Director 五阶段流程产出
`<topic>-ppt.html`，在 probe 阶段随 body 提交（上限 2 MB），服务端按订单落库；
用户付款后 complete 阶段由服务端读回并交付。

| 维度 | 说明 |
|---|---|
| 价格 | 5.00 元/次 |
| 资源生成 | Agent 端 Director 五阶段（Requirements / Outline / Visual / Builder / QA） |
| 内容规模 | 按用户 query 动态生成 10-18 页 |
| 视觉风格 | Visual agent 按风格 16 选 1 定制 |
| 图表 | ECharts 动态图表 |
| QA 门禁 | `qa_static.py` 静态扫描 + `references/qa-checklist.md` 手动核查 |

### 商家侧已知限制

- **订单持久化**：订单落到对象存储（每单一个 JSON，`orders/<out_trade_no>.json`），
  跨实例、跨部署可读，容器回收不丢单；`/api/status` 的 `durable` 由真实写入探针判定，不再按路径猜测。
- **notify_url 未接**：当前以交易查询（`402-query-payment-status`）验收，配合
  `POST /api/v1/pay/sweep` 做补偿查询。
- **自买自卖限制**：真实交易联调必须用**第二个支付宝账号**付款，
  不能用开通 AI 付的 seller 账号。