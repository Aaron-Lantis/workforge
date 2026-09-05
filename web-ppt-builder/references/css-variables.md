# CSS Variables — Canonical Token List & Theme Recipes

Every deck uses ONE `:root` block. All other CSS references these tokens. No hard-coded color literals in components.

## Core tokens

```css
:root {
  /* Color — primary surface */
  --bg:               #0a0e1a;     /* main background */
  --bg-alt:           #0f1424;     /* alternate surface (cards on bg) */
  --surface:          rgba(255,255,255,0.04);  /* glass card */
  --surface-strong:   rgba(255,255,255,0.08);
  --line:             rgba(255,255,255,0.10);  /* border */
  --line-strong:      rgba(255,255,255,0.18);

  /* Color — text */
  --text:             #e8edf6;     /* primary text */
  --text-soft:        #b9c1d6;     /* secondary text */
  --muted:            #8b96ad;     /* tertiary / meta text */
  --inverse:          #0a0e1a;     /* text on light surface */

  /* Color — accent (the brand color) */
  --accent:           #6ea8ff;     /* primary accent */
  --accent-2:         #8f7bff;     /* secondary accent */
  --accent-3:         #2fbf8f;     /* tertiary / success */
  --accent-warn:      #f5c76a;     /* warning / highlight */
  --accent-danger:    #ff5b5b;     /* danger / negative */

  /* Gradient combo (use sparingly — only on cover, section break, closing) */
  --grad-hero:        radial-gradient(1200px 600px at 80% -10%, rgba(110,168,255,0.18), transparent 60%),
                      radial-gradient(900px 500px at -10% 30%, rgba(143,123,255,0.12), transparent 55%),
                      radial-gradient(700px 400px at 50% 110%, rgba(47,191,143,0.08), transparent 60%);

  /* Spacing — 4px grid */
  --s-1: 4px;
  --s-2: 8px;
  --s-3: 12px;
  --s-4: 16px;
  --s-5: 24px;
  --s-6: 32px;
  --s-7: 48px;
  --s-8: 64px;
  --s-9: 96px;

  /* Radii */
  --r-sm: 8px;
  --r-md: 14px;
  --r-lg: 20px;
  --r-xl: 28px;
  --r-pill: 999px;

  /* Shadows */
  --sh-1: 0 1px 2px rgba(0,0,0,0.20);
  --sh-2: 0 6px 18px rgba(0,0,0,0.30);
  --sh-3: 0 20px 60px rgba(0,0,0,0.40);
  --glow: 0 0 32px rgba(110,168,255,0.35);

  /* Typography */
  --font-sans:  -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
  --font-serif: "Source Han Serif SC", "Noto Serif SC", "Songti SC", "Times New Roman", serif;
  --font-mono:  ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;

  /* Slide frame */
  --slide-pad: clamp(32px, 4vw, 80px);  /* responsive padding */
  --slide-w:   1280px;
  --slide-h:   720px;
}
```

## Theme recipes

Pick one and substitute the color block. Everything else stays.

### 1. 深色科技 (default for tech, AI, AI agent, fintech)

```css
:root {
  --bg: #070b16;
  --bg-alt: #0d1224;
  --surface: rgba(255,255,255,0.045);
  --surface-strong: rgba(255,255,255,0.07);
  --line: rgba(255,255,255,0.09);
  --text: #e8edf6;
  --text-soft: #c8d2e6;
  --muted: #8b96ad;
  --accent: #6ea8ff;
  --accent-2: #8f7bff;
  --accent-3: #2fbf8f;
  --accent-warn: #f5c76a;
  --accent-danger: #ff5b5b;
}
```

### 2. 学术汇报 (paper defense, thesis)

```css
:root {
  --bg: #f7f5ef;          /* warm off-white */
  --bg-alt: #ffffff;
  --surface: rgba(15,23,42,0.03);
  --surface-strong: rgba(15,23,42,0.06);
  --line: #e2e0d6;
  --text: #1f2a44;        /* deep navy */
  --text-soft: #334155;
  --muted: #64748b;
  --accent: #1e3a8a;      /* academic blue */
  --accent-2: #b91c1c;    /* academic red */
  --accent-3: #15803d;
  --accent-warn: #b45309;
  --accent-danger: #991b1b;
  --font-sans: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-serif: "Source Han Serif SC", "Noto Serif SC", "Songti SC", "Times New Roman", serif;
}
```

Use `var(--font-serif)` for titles in this theme.

### 3. 财经 / 商务专业 (financial, pitch deck)

```css
:root {
  --bg: #0a1628;
  --bg-alt: #0f1e35;
  --surface: rgba(212,175,55,0.04);  /* gold tint */
  --surface-strong: rgba(212,175,55,0.08);
  --line: rgba(212,175,55,0.18);
  --text: #f3f4f6;
  --text-soft: #d1d5db;
  --muted: #9ca3af;
  --accent: #d4af37;       /* gold */
  --accent-2: #2563eb;     /* royal blue */
  --accent-3: #10b981;     /* positive */
  --accent-warn: #f59e0b;
  --accent-danger: #ef4444;
}
```

### 4. 液态玻璃 / 杂志 (glassmorphism, modern magazine)

```css
:root {
  --bg: #1a1a2e;
  --bg-alt: #232347;
  --surface: rgba(255,255,255,0.06);
  --surface-strong: rgba(255,255,255,0.10);
  --line: rgba(255,255,255,0.12);
  --text: #f8fafc;
  --text-soft: #cbd5e1;
  --muted: #94a3b8;
  --accent: #f472b6;       /* pink */
  --accent-2: #a78bfa;     /* lavender */
  --accent-3: #34d399;     /* mint */
  --accent-warn: #fbbf24;
  --accent-danger: #fb7185;
}
```

Use `backdrop-filter: blur(20px)` on every card.

### 5. 商务浅色 / 商务专业 light variant (consulting deck)

```css
:root {
  --bg: #ffffff;
  --bg-alt: #f8fafc;
  --surface: rgba(15,23,42,0.02);
  --surface-strong: rgba(15,23,42,0.04);
  --line: #e5e7eb;
  --text: #0f172a;
  --text-soft: #334155;
  --muted: #64748b;
  --accent: #1d4ed8;
  --accent-2: #7c3aed;
  --accent-3: #059669;
  --accent-warn: #d97706;
  --accent-danger: #dc2626;
}
```

### 6. 产品发布 / 创意活泼 (launch, playful)

```css
:root {
  --bg: #0c0a1e;
  --bg-alt: #1a1635;
  --surface: rgba(255,255,255,0.05);
  --surface-strong: rgba(255,255,255,0.10);
  --line: rgba(255,255,255,0.12);
  --text: #ffffff;
  --text-soft: #d1d5db;
  --muted: #9ca3af;
  --accent: #fde047;       /* bright yellow */
  --accent-2: #fb7185;     /* coral */
  --accent-3: #34d399;     /* mint */
  --accent-warn: #fb923c;
  --accent-danger: #ef4444;
}
```

Use big bold typography. Generous spacing. Big pill buttons.

### 7. 报纸 / 印刷 (editorial, magazine, year-in-review)

```css
:root {
  --bg: #fafaf6;
  --bg-alt: #f0eee5;
  --surface: rgba(0,0,0,0.02);
  --surface-strong: rgba(0,0,0,0.04);
  --line: #1f2937;
  --text: #111827;
  --text-soft: #374151;
  --muted: #6b7280;
  --accent: #991b1b;
  --accent-2: #1f2937;
  --accent-3: #166534;
  --accent-warn: #92400e;
  --accent-danger: #991b1b;
  --font-sans: Georgia, "Source Han Serif SC", serif;
  --font-serif: Georgia, "Source Han Serif SC", serif;
```

Use thin hairline borders, serif headlines, drop caps for editorial feel.

## v2.0 — UI/UX 增强约定（Apple HIG 启发）

在基础 tokens 之上，为达到 Apple 级质感，追加以下一组增强 tokens 到同一个 `:root`。**任何 `var()` 之外的裸色值一律禁止。**

```css
:root {
  /* 层叠阴影 —— 用 2~3 层分别模拟接触阴影+大气阴影+环境光 */
  --sh-card:       0 1px 2px rgba(0,0,0,0.30), 0 4px 12px rgba(0,0,0,0.35), 0 12px 32px rgba(0,0,0,0.22);
  --sh-card-hover: 0 2px 4px rgba(0,0,0,0.32), 0 10px 28px rgba(0,0,0,0.40), 0 24px 64px rgba(0,0,0,0.28);
  --sh-float:      0 8px 20px rgba(0,0,0,0.36), 0 24px 60px rgba(0,0,0,0.30);

  /* Apple 风格缓动 */
  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);   /* 主缓动，出场/进入 */
  --ease-out-expo:  cubic-bezier(0.16, 1, 0.3, 1);    /* 更快的大动作 */
  --ease-spring:    cubic-bezier(0.34, 1.56, 0.64, 1); /* 带弹性回弹 */

  /* Apple 字号阶梯 caption→display（10 档） */
  --t-caption:  11px;
  --t-footnote: 12px;
  --t-subhead:  15px;
  --t-body:     17px;
  --t-headline: 20px;
  --t-title-3:  24px;
  --t-title-2:  30px;
  --t-title-1:  38px;
  --t-large:    48px;
  --t-display:  64px;
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
}
```

### 图标：统一用 FontAwesome 6，禁用 emoji
- CDN：`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css">`
- 控件（导航/编辑/全屏）必须用 FA 图标：`fa-backward-step` `fa-chevron-left/right` `fa-forward-step` `fa-expand` `fa-pen` `fa-bars`
- 元信息行可用 FA 点缀：`fa-cat` `fa-calendar` `fa-chart-line` `fa-envelope` `fa-arrows-rotate`

### ★ 内容可见性兜底（必守 —— 本次自测血的教训）
**入场动画只负责「上浮/位移」点缀，绝不允许用 `@keyframes` 的 `from{opacity:0}` + `animation-fill-mode: both` 来控制「内容是否可见」。**

原因：`both`（即 backwards）会在动画**尚未播放**（如元素刚由 `display:none`→`flex` 的瞬间、headless 截图、低端机合成时序）时，强加 `from` 状态 `opacity:0`——一旦动画不推进，内容就**永久空白**。真实浏览器用户翻页时动画正常，但任何动画被抑制的环境都会丢内容。

正确写法（三选一，推荐 A）：
```css
/* A. 纯位移动画，opacity 恒为 1 —— 最稳 */
@keyframes riseIn { from { transform: translateY(24px); } to { transform: translateY(0); } }
.card { animation: riseIn 600ms var(--ease-out-expo) forwards; }  /* 元素默认 opacity:1 */

/* B. 若要淡入，用 forwards（而非 both），且元素不要预设 opacity:0 */
@keyframes fadeUp { from { opacity: 0; transform: translateY(12px);} to { opacity: 1; transform: translateY(0);} }
.card { animation: fadeUp 600ms var(--ease-out-expo) forwards; }  /* 动画前元素用默认(可见)样式 */

/* C. 用 `animation-fill-mode: backwards` 但保证 from 态可见（不控 opacity） —— 不推荐，易踩坑 */
```

**QA 检查点**：搜索 HTML 里的 `opacity:0` 与 `animation:...both`。凡两者同现于一个内容容器上 = 高风险，必须改为 A 方案。

### ECharts 配色约定（A 股红涨绿跌，若为其他市场按需替换）
- 从 CSS 变量读取，不裸写色值：`getComputedStyle(document.documentElement).getPropertyValue('--accent-danger')` 等，读取失败给兜底默认值。
- K 线（candlestick）：**每根显式指定** `itemStyle.color`（涨红=`--accent-danger`）/ `color`（跌绿=`--accent-3`），不要只依赖 `color0` 自动判定 —— 主题/版本差异会导致全画同色（本次真实踩坑：`#color`/`#color0` 在 dark 主题下全渲染成红）。
- 柱状图比对：正/负值用 `{ value: x, itemStyle: { color } }` 逐个着色。
- 所有图表包一层 `typeof echarts === 'undefined'` fallback，CDN 离线时展示提示文案而非 JS 报错。

## How to use

1. Pick the recipe (or design your own by editing 5–10 tokens).
2. Copy the `:root` block into the head of your HTML.
3. All component CSS uses `var(--token-name)` — never hex literals outside `:root`.
4. To switch themes later, swap the `:root` block. Done.

## Quick sanity check

After applying a theme, run this in DevTools:
```js
document.documentElement.style.cssText  // should show your variables
getComputedStyle(document.body).backgroundColor  // should match --bg
```