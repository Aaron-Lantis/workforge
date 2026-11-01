# CDN Stack — Pinned URLs

Use these CDN URLs for external libs. Pin a major version (e.g. `@5`) so future major releases don't break your file.

If a CDN fails (offline / blocked), provide a graceful fallback.

## Vue3 / Shadcn 的取舍（与原始提示的已知偏差）

原始 canonical prompt 要求 Vue3 + Tailwind + Shadcn。本技能**默认不引入 Vue3**，理由与边界：

- 引入 Vue3 后必须在 `#app` 挂载完成前隐藏内容或渲染骨架，否则首帧空白 → 与「双击即开、断网可用」冲突；
- Shadcn 依赖构建期（Tailwind 插件 + 组件源码），CDN 场景下不可用。

因此默认 **Tailwind Play CDN + 原生 JS**；只有当用户明确说「要 Vue3 / 要 Shadcn」时，才加：

```html
<script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js"></script>
```

加了 Vue3 就必须配 `v-cloak` + `[v-cloak]{display:none}`，并接受「断网且 CDN 不可达时整页空白」这一代价——这一点要主动告知用户，不能默默降级。

## Stylesheets

```html
<!-- FontAwesome 6 (icons) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6/css/all.min.css">

<!-- Animate.css 4 (entrance animations) -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/animate.css@4/animate.min.css">

<!-- Tailwind Play CDN (utility classes) -->
<script src="https://cdn.tailwindcss.com"></script>
```

## Scripts

```html
<!-- ECharts 5 (charts) -->
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>

<!-- Three.js 0.16x (3D / WebGL hero scenes) -->
<script src="https://cdn.jsdelivr.net/npm/three@0.160/build/three.min.js"></script>

<!-- Lucide icons (inline JS) -->
<script src="https://unpkg.com/lucide@latest"></script>

<!-- Anime.js 3 (micro-animations) -->
<script src="https://cdn.jsdelivr.net/npm/animejs@3/lib/anime.min.js"></script>
```

## Mirrors

If jsdelivr is blocked or slow, swap to:
- `https://unpkg.com/<pkg>@<version>/...` — same npm packages, different CDN
- `https://cdnjs.cloudflare.com/ajax/libs/...` — limited coverage
- `https://cdn.skypack.dev/<pkg>` — ESM-focused

## Version pinning rules

- Pin **major** version (`@5`, `@6`, `@3`). Minor versions can ship breaking changes in JS-heavy libs (Tailwind, ECharts theme options).
- For Tailwind CDN: do not pin minor — the `cdn.tailwindcss.com` script is itself the pin; you get whatever version is current there. Acceptable for prototypes only.
- For fonts via Google Fonts: pin major + minor, e.g. `https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap`.

## Fallback pattern (offline-safe)

```html
<script>
  // ECharts CDN check + fallback
  if (typeof echarts === 'undefined') {
    document.querySelectorAll('.chart').forEach(el => {
      el.innerHTML = '<div class="chart-fallback">图表加载失败（离线？）<br>' + (el.dataset.label || '') + '</div>';
    });
  } else {
    document.querySelectorAll('.chart').forEach(el => {
      const chart = echarts.init(el, null, { renderer: 'canvas' });
      try {
        chart.setOption(JSON.parse(el.dataset.option));
        new ResizeObserver(() => chart.resize()).observe(el);
      } catch (e) {
        el.innerHTML = '<div class="chart-fallback">图表配置错误</div>';
      }
    });
  }
</script>

<style>
.chart-fallback {
  display: flex; align-items: center; justify-content: center;
  height: 100%; color: var(--muted); text-align: center; padding: 24px;
  border: 1px dashed var(--line); border-radius: var(--r-md);
}
</style>
```

## Loading strategy

- Put stylesheets in `<head>` so they're parsed before paint.
- Put scripts at the bottom of `<body>` (right before `</body>`) so they don't block render.
- Use `defer` for non-critical scripts (browsers may not honor it on CDN scripts without `async`).
- For Three.js heavy scenes: load on demand inside `IntersectionObserver` callback.

## Performance

- ECharts full bundle is ~1MB gzipped. If you only need 2-3 chart types, use the tree-shaken build:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  ```
  Then `echarts.init()` works with any chart type — no further imports needed.
- Three.js is ~600KB gzipped. Only load it if you actually have a 3D scene; skip otherwise.
- FontAwesome full CSS is ~70KB. Trim with the `@fortawesome/fontawesome-free@6/css/fontawesome.min.css` + individual icon CSS if you only need 5-10 icons.