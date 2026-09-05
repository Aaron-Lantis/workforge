# web-ppt-builder · Skill

> 单文件 HTML 网页 PPT 多智能体流水线 —— Director + 5 specialists + 静态 QA 门禁 + Edge headless 真机验证。

[![Skill](https://img.shields.io/badge/Agent-Skill-6ea8ff)](#)
[![Version](https://img.shields.io/badge/version-v1.0.0-2fbf8f)](#)
[![License](https://img.shields.io/badge/license-MIT-c8d2e6)](#)

---

## 这是什么

一个**面向"高质量、无 bug"的网页 PPT 交付任务**设计的 AI 助手 Skill。

调用方(Director + 用户)给出一段自然语言需求,该 Skill:

1. **多智能体协作** —— 把任务拆给 Requirements / Outline / Visual / Builder / QA 五个 specialist,各司其职,通过 `_ppt-whiteboard/` 共享白板交接
2. **手把手 brief 模板** —— 每个 specialist 有 copy-paste 即可用的派工指令,边界明确、不让下游猜
3. **静态 QA 门禁** —— `scripts/qa_static.py` 不需要浏览器就能抓 25+ 类结构缺陷(数据跳号、handler 缺失、hex 颜色泄漏、JS 大括号不平衡 等)
4. **真机视觉验证** —— 文档内置 **Edge headless** 零依赖命令行,翻页截图覆盖全套交付物
5. **可拓展 UI/UX 约定** —— `references/css-variables.md` 内置 Apple HIG 启发式设计 token(层叠阴影、字号阶梯、缓动函数),`qa-checklist.md` 已固化的"P0 内容可见性兜底"条款来自实战踩坑

---

## 目录结构

```
web-ppt-builder/
├── SKILL.md                       # ★ 技能主入口 / Director 调度规则
├── README.md                      # 你正在读的这一份
├── templates/                     # 参考模板库 — 完整、过门禁的真实交付物
│   └── ai-agents-2026.html        #   15 页 AI 产业汇报(深色科技+液态玻璃)
├── references/                    # 5 个 specialist 派工 brief + 工程契约 + 设计素材
│   ├── agent-roles.md             # 5 个角色的 copy-paste 派工指令
│   ├── outline-schema.md          # outline 文件的强制 schema + 8 项 self-check
│   ├── engineering-contract.md    # Builder 与 QA 共用的工程契约
│   ├── layout-catalog.md          # L01-L20 标准布局样板
│   ├── css-variables.md           # 7 套主题 token + v2.0 Apple HIG 增强约定
│   ├── cdn-stack.md               # 钉死的 ECharts / FontAwesome / 字体 CDN
│   ├── qa-checklist.md            # 交付前 11 类 ~70 条 QA 闸门
│   └── prompt-template.md         # 用户原始提示词存档 + 18 个【填…】占位符映射
└── scripts/
    └── qa_static.py               # 零依赖的静态 QA 门禁（无需浏览器）
```

---

## 谁适合用

- 经常需要做**对外演示/汇报**(投资人、客户、高管、技术评审)又不想为格式反复调试
- 习惯用 AI 编程助手,且希望**一次性拿到"功能正确 + 视觉到位 + 无 bug"的成品**而不是多轮迭代
- 想要**深度自定义主题**(配色、字号、阴影、缓动)而不被某个 SaaS 模板绑架

不适合的场景:

- 需要 LaTeX / Beamer PDF 学术派风格(本 skill 默认走 HTML)
- 需要 Microsoft PowerPoint 原生 .pptx 产物(本 skill 走 HTML 路线,不产出 .pptx)

---

## 三分钟跑一遍

### Step 1 — 准备派工白板

在你要生成 PPT 的项目根目录创建一个 `_ppt-whiteboard/` 文件夹(交付物旁边即可):

```bash
mkdir _ppt-whiteboard
```

### Step 2 — 把 5 个角色拉起来

把 `references/agent-roles.md` 中的 5 段 brief 直接复制给你的 AI 助手,分别开 5 个会话(或在一次会话里按顺序派):

- **Requirements Agent** → 输出 `01-brief.md` 到白板
- **Outline Agent** → 输出 `02-outline.md`(字段 schema 强约束,见 `outline-schema.md`)
- **Visual Agent** → 输出 `03-design-brief.md` + `assets/theme.css`
- **Builder Agent** → 输出 `04-builder-notes.md` + 最终 `your-deck.html`
- **QA Agent** → 输出 `04-qa-report.md`

### Step 3 — 跑静态 QA

```bash
# QA agent 必须先跑（零依赖）
python scripts/qa_static.py your-deck.html
# 期望输出: PASS - all structural checks
```

任何 FAIL 立刻返回 Builder 修,修完跑通为止。

### Step 4 — 视觉真机验证

QA agent 用 **Edge headless** 逐页截图覆盖(无需 agent-browser / playwright):

```bash
# Windows 自带 Edge 即可,完整命令见 references/agent-roles.md → QA brief
msedge --headless=new --disable-gpu \
       --window-size=1920,1080 --virtual-time-budget=10000 \
       --screenshot="out.png" "file:///.../your-deck.html#5"
```

---

## 设计哲学

- **多智能体 > 单 agent**:Reasoning 极易让单个 agent 跳过确认、混淆关注点、交付破损布局。5 个 specialist + 共享白板 + 显式 hand-off contract 才能稳
- **QA self-report 不可信**:Builder 声称 PASS 时仍会漏结构缺陷。**必须有自动化门禁**(`qa_static.py`)
- **headless 截图必须覆盖全套**而非只截封面
- **入场动画只做点缀(translateY)**,**绝不让 `@keyframes from{opacity:0}` + `animation-fill-mode:both` 控制内容是否可见**(详见 css-variables.md「内容可见性兜底」—— 这是实战踩坑 P0)
- **K 线(candlestick)逐根显式指定涨跌色**,不依赖 `color/color0` 自动判定(dark 主题下会全画同色)

---

## 模板库（templates/）

`templates/` 下的每份模板都是**完整、通过 QA 门禁的真实交付物**——Visual / Builder 开工前应先查阅最接近目标风格的模板，以其为结构、主题与交互的参考实现：

- **`ai-agents-2026.html`** — 15 页 AI 产业汇报（深色科技 + 液态玻璃），覆盖 13 种标准布局、3 类 ECharts 图表、完整键盘导航 / 缩略导航 / 进度条 / 编辑模式（本地持久化）/ 打印布局 / 响应式。

**新增模板的准入规则**：必须 `qa_static.py` exit 0；严格使用 `css-variables.md` 的 token 体系；文件头注释写明主题 / 布局覆盖 / 特性清单。

---

## 版本与变更

- **v1.0.0** (2026-09-06): 首次公开
  - Director + 5 specialists 多智能体流水线
  - `qa_static.py` 静态门禁(零依赖)
  - Apple HIG v2.0 UI/UX 约定(层叠阴影、字号阶梯、缓动、FontAwesome 6 替代 emoji)
  - Edge headless 真机视觉验证路径
  - 内容可见性兜底 / K 线涨跌色 / ECharts fallback 三条实战条款

---

## License

MIT — 自由使用,保留版权即可。

---

## Contribution

Issues and pull requests welcome. Open a thread under the `skill/web-ppt-builder` label.
