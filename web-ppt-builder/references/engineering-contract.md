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