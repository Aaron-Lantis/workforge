# Engineering Contract

This is the contract between the Builder agent and the QA agent. The QA agent uses this file to verify the Builder's output.

## File Structure

The output is ONE HTML file. No sibling files. No local assets. CDN only.

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>…</title>

  <!-- Optional: CDN stylesheets (only what's needed) -->
  <link rel="stylesheet" href="<CDN: fontawesome or animate.css>">

  <!-- Optional: Tailwind play CDN -->
  <script src="https://cdn.tailwindcss.com"></script>

  <style>
    /* :root block: paste from theme.css verbatim */
    :root { … }

    /* CSS reset */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    /* Slide frame + responsive grid */
    /* Component styles using var(--…) tokens */
    /* Animations */
    /* @media queries */
    /* @media print */
  </style>
</head>
<body>
  <main class="deck" id="deck">
    <section class="slide active" data-index="1">…</section>
    <section class="slide" data-index="2">…</section>
    …
    <nav class="controls" aria-label="演示导航">
      <button data-action="first">⏮</button>
      <button data-action="prev">◀</button>
      <span class="page-indicator">1 / 10</span>
      <button data-action="next">▶</button>
      <button data-action="last">⏭</button>
      <button data-action="fullscreen">⛶</button>
      <button data-action="edit">✎</button>
    </nav>
    <aside class="thumbs" aria-label="缩略图导航">…</aside>
  </main>

  <!-- Optional: CDN scripts (only what's needed) -->
  <script src="<CDN: echarts>"></script>

  <script>
    /* state object */
    /* goTo(i) */
    /* event listeners: keyboard, wheel, click, touch */
    /* chart init + resize observer */
    /* edit mode toggle + localStorage persistence */
  </script>
</body>
</html>
```

## CSS Architecture Rules

1. **All theme tokens live in `:root`**. The Builder pastes `theme.css` verbatim. No hex literals in component CSS — only `var(--…)`.
2. **4px / 8px spacing grid**. Padding, margin, gap — multiples of 4.
3. **Responsive sizing via `clamp()`**:
   - `clamp(28px, 4vw, 56px)` for slide titles
   - `clamp(14px, 1.4vw, 18px)` for body text
   - `clamp(32px, 4vw, 80px)` for slide padding
4. **GPU-friendly effects**: `transform`, `opacity`, `filter: blur` on small elements; `backdrop-filter: blur` on cards. Avoid animating `width`/`height`/`top`/`left`.
5. **No `filter: blur` on the slide background** — too expensive.
6. **Print styles** mandatory:
   ```css
   @media print {
     .controls, .thumbs, .progress { display: none !important; }
     .slide {
       page-break-after: always;
       width: 100%; height: 100vh;
       display: flex !important;
       position: relative !important;
       opacity: 1 !important;
     }
     body { background: white; }
   }
   ```

## JS Architecture Rules

1. **One state object**:
   ```js
   const state = { index: 0, total: 0, mode: 'normal'|'fullscreen'|'edit' };
   ```
2. **One `goTo(i)` function** — every navigation calls it. Never set `state.index` directly outside `goTo`.
3. **Debounce wheel handler** (150–250ms) to prevent skipping pages on trackpads.
4. **Touch swipe**: track touchstart/touchend, require |Δx| > 60px and |Δy| < 40px to count as a swipe.
5. **Keyboard**:
   - `ArrowRight` / `ArrowDown` / `Space` / `PageDown` → next
   - `ArrowLeft` / `ArrowUp` / `PageUp` → prev
   - `Home` → first
   - `End` → last
   - `Escape` → exit fullscreen
   - `F` → toggle fullscreen
   - `E` → toggle edit mode
6. **Resize observer on every chart container**:
   ```js
   const ro = new ResizeObserver(() => chart.resize());
   ro.observe(container);
   ```
7. **Edit mode**: `document.body.classList.toggle('edit-mode')`. In edit mode, `.slide-title, .slide-body` become `contenteditable`. On blur, persist `localStorage.setItem('ppt-edits', JSON.stringify(edits))`. On load, apply edits before rendering.
8. **CDN fallback for critical scripts**:
   ```js
   if (typeof echarts === 'undefined') {
     document.querySelectorAll('.chart').forEach(el => {
       el.innerHTML = '<div class="chart-fallback">' + (el.dataset.label || '图表加载失败') + '</div>';
     });
   } else { /* init charts */ }
   ```

## Animation Rules

1. **Page transition**: 220–320ms, either cross-fade OR translateX(±40px) slide. Not both.
   ```css
   .slide { opacity: 0; transition: opacity 280ms ease; }
   .slide.active { opacity: 1; }
   ```
2. **Element stagger**: 60–100ms per element, total ≤ 800ms.
   ```css
   .stagger > * { opacity: 0; animation: fadeIn 400ms ease forwards; }
   .stagger > *:nth-child(1) { animation-delay: 100ms; }
   .stagger > *:nth-child(2) { animation-delay: 200ms; }
   …
   ```
3. **Hover**: `translateY(-2px)` + shadow change, 180ms ease. Only on `.card, button, .click-zone`.
4. **prefers-reduced-motion**:
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

## Chart Integration Rules (ECharts)

1. Wrap each chart in a fixed-aspect container:
   ```html
   <div class="chart" data-label="板块涨幅" data-option='{"…":"…"}' style="aspect-ratio: 16/9;"></div>
   ```
2. Always set tooltip/legend styles to match text color.
3. For dark themes, pass `'dark'` as the theme: `echarts.init(el, 'dark')`.
4. Provide try/catch around `setOption`; on failure, render the fallback element.

## Accessibility Rules

1. Semantic HTML: `<main>`, `<nav>`, `<section>`, `<h1>` (cover), `<h2>`+ (content).
2. All icon-only buttons have `aria-label`:
   ```html
   <button data-action="next" aria-label="下一页">▶</button>
   ```
3. Focus-visible rings:
   ```css
   :focus-visible {
     outline: 2px solid var(--accent);
     outline-offset: 2px;
   }
   ```
4. Color contrast:
   - Body text: ≥ 4.5:1 against its background
   - Large text (≥ 24px or ≥ 18px bold): ≥ 3:1
   - Decorative text or icons: any contrast (still avoid same-color text)
5. ARIA live region for page indicator:
   ```html
   <span class="page-indicator" aria-live="polite">1 / 10</span>
   ```

## Robustness Rules

1. No `eval`, no `Function()`.
2. No `innerHTML = userData` — use `textContent` or escape first.
3. All `<a>` links get `target="_blank" rel="noopener noreferrer"`.
4. All external CDN URLs are `https://`.
5. The HTML loads successfully even if all CDNs are blocked (fallbacks cover this).

## Mandatory Deck Contract (machine-enforced)

`scripts/qa_static.py` fails the build if any item below is missing. These are not suggestions — treat them as compile errors.

### 1. Five page types, marked in markup

Every slide root carries `data-slide="<type>"`. The type vocabulary is closed:

| `data-slide` | Page | Required content |
|---|---|---|
| `cover` | 封面 | 大标题 + 副标题 + **日期** + **演讲者/团队** + 图形/渐变装饰 |
| `toc` | 目录 | 章节列表 + **真图标**（FontAwesome/Lucide）+ 逐条淡入 |
| `section` | 章节标题页 | 章节序号 + 章节标题 + 3~5 条要点概览（**≥2 页**，当前章节序号高亮） |
| `content` | 内容页 | 一个核心要点；大数字/表格/图表按需 |
| `end` | 封底 | 感谢语/号召语 + 联系方式或二维码（与封面呼应） |

```html
<section class="slide" data-slide="cover"  data-index="1">…</section>
<section class="slide" data-slide="toc"    data-index="2">…</section>
<section class="slide" data-slide="section" data-index="3">…</section>
<section class="slide" data-slide="content" data-index="4">…</section>
<section class="slide" data-slide="end"    data-index="19">…</section>
```

`data-index` must run 1..N with no gaps.

### 2. Complete navigation surface

| Capability | Implementation requirement |
|---|---|
| 全屏 | `toggleFullscreen(` on a button |
| 缩略图导航（左侧） | `class="thumbs"` container built by `buildThumbs(` |
| 首/上/下/末页按钮 | Four distinct `data-action` values (`first` `prev` `next` `last`) — all four must exist |
| 页码指示 | `1 / N`, `aria-current="true"` on the active thumbs item |
| 键盘 | `ArrowUp/Down/Left/Right`, `Home/End` |
| 滚轮 | wheel listener, throttled ≥300ms |
| 触屏 | touch swipe (touchstart/touchend) |
| 编辑模式 | `contenteditable` toggled by `toggleEdit(`, persisted to localStorage |
| 深浅色 | `toggleTheme(` + `data-theme` on `<html>` + localStorage, keyboard `T` |
| 打印 | `@media print` — one slide per page, chrome hidden |

### 3. Aspect-ratio adaptation (16:9 + 4:3)

Slides must letterbox correctly at both ratios. Use an aspect-driven media query and a `--deck-aspect` variable so 4:3 projectors don't clip content:

```css
.stage { aspect-ratio: 16 / 9; }
@media (max-aspect-ratio: 4/3) {
  .stage { aspect-ratio: 4 / 3; }
  .slide { padding: clamp(20px, 4vh, 56px) clamp(24px, 4vw, 72px); }
}
```

### 4. Data truthfulness (hard rule)

Every number, percentage, or ranking on a slide carries **source + scope + as-of date** (page footer or directly under the chart). Invented "illustrative" figures are forbidden — if a reliable figure cannot be found, drop the number and use a qualitative statement instead.

```html
<figcaption>数据来源：XX 研究院《…报告》2026Q2，口径＝全球出货量 · 截至 2026-09</figcaption>
```

### 5. Chinese comments in code

Key logic carries `//` comments in Chinese (nav dispatch, wheel throttle, theme switch, edit persistence, chart init). At least 8 commented lines are expected; `qa_static.py` counts them.

## What the QA Agent Checks

Per the brief, QA reads `references/qa-checklist.md` and verifies every item against the rendered HTML. Common checks the engineering contract implies:

- [ ] Theme tokens are all in `:root`, no hex literals elsewhere
- [ ] All `clamp()` calls produce readable font sizes across viewport widths
- [ ] `prefers-reduced-motion` query present
- [ ] `@media print` present and hides chrome
- [ ] `goTo(i)` is the only entry point that changes the active slide
- [ ] Wheel handler is debounced
- [ ] ResizeObserver attached to each chart
- [ ] ECharts fallback path exists
- [ ] All icon-only buttons have `aria-label`
- [ ] No `eval` / `Function` / unescaped `innerHTML`
- [ ] Semantic HTML structure
- [ ] All `<a>` have `rel="noopener"`