---
name: web-ppt-builder
description: Build a single-file HTML web presentation (web PPT) end-to-end via a multi-agent pipeline. Use when the user asks for a slide deck, web presentation, 网页PPT, 单文件HTML演示, 论文答辩, 学术汇报, 技术分享, 产品发布 or shows the canonical prompt beginning "你是一位资深的前端开发专家、网页设计专家、PPT设计专家…". A Director agent coordinates five specialists (Requirements / Outline / Visual / Builder / QA) that write to a shared whiteboard, hand off artifacts, and gate delivery on a mandatory QA pass.
agent_created: true
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