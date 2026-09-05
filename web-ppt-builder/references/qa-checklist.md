# Pre-Delivery Quality Gate (Web PPT)

Run every item below before declaring the file done. Any unchecked item = the file is NOT done.

## A. Structural Integrity

- [ ] Single `.html` file at the agreed output path
- [ ] No `src=` / `href=` to local files that don't exist next to the HTML (CDN is fine)
- [ ] `<!doctype html>` is present; `lang` attribute on `<html>` is set
- [ ] `<title>` describes the deck
- [ ] `<meta viewport>` is set for mobile scaling

## B. Layout & Visual

- [ ] All slides render at 1280×720 reference without content overflow
- [ ] No element clips outside `body` at default 16:9
- [ ] No text runs off the right edge on any slide at default 1280px width
- [ ] No two elements overlap unintentionally
- [ ] Color contrast ≥ 4.5:1 for body, ≥ 3:1 for headings (use a contrast checker if unsure)
- [ ] Section break pages appear every 3–6 content pages
- [ ] Cover and closing pages share a visual motif

## C. Navigation

- [ ] First / Prev / Next / Last buttons work
- [ ] `←` `→` `↑` `↓` keys advance
- [ ] `Home` jumps to slide 1; `End` jumps to last
- [ ] `Esc` exits fullscreen if active; `F` enters fullscreen
- [ ] Mouse wheel scrolls only one slide per gesture (debounced)
- [ ] Click zones on left/right edges navigate prev/next
- [ ] Touch swipe left/right works on a touch device (test with browser devtools)
- [ ] Thumbnail sidebar (if enabled) highlights current slide and jumps on click
- [ ] Page indicator shows `current / total` correctly
- [ ] URL hash (`#3`) is updated and respected on load

## D. Animation & Motion

- [ ] Page transition runs smoothly, no jank (60fps target)
- [ ] Element entrance stagger ≤ 800ms total
- [ ] `prefers-reduced-motion: reduce` disables animations
- [ ] No animation runs forever on the cover (avoids battery drain and feels cheap)
- [ ] Hover/focus states visible on all interactive elements
- [ ] **内容可见性兜底（P0）**: 内容容器绝对不因入场动画不可见。搜索 `opacity:0` 与 `animation:...both`——凡同现于内容容器 = FAIL。入场动画只做 transform 位移，`@keyframes` 的 `from` 不得含 `opacity:0`（详见 css-variables.md「内容可见性兜底」）。

## E. Charts (if used)

- [ ] All ECharts instances call `.resize()` on window resize
- [ ] Container has fixed aspect ratio (never `width: 100%; height: auto`)
- [ ] Chart tooltip/legend colors match the deck text color
- [ ] Fallback: if `echarts` global is undefined, show a static placeholder instead of throwing
- [ ] **K线涨跌色（P1）**: candlestick 每根显式指定 `itemStyle.color`（涨）/ `itemStyle.color`（跌），不依赖 `color`/`color0` 自动判定（dark 主题下易全画同色）。A 股红涨绿跌。

## F. Responsive

- [ ] At 768px (tablet portrait): text readable, no horizontal scroll, charts don't collapse to zero height
- [ ] At 375px (mobile): deck mode auto-switches to vertical-scroll or single-column mode
- [ ] `clamp()` is used for all slide titles and large numbers
- [ ] Touch targets ≥ 44×44px

## G. Print / Export to PDF

- [ ] `@media print` hides nav chrome (buttons, thumbnails, page indicator)
- [ ] `@media print` sets `@page { size: landscape }` so PDF export is landscape
- [ ] Page-break behavior: each slide is one printed page
- [ ] Print preview tested in Chrome (Cmd/Ctrl+P)

## H. Accessibility

- [ ] All buttons / nav elements have `aria-label`
- [ ] Keyboard focus order is logical (Tab moves through controls)
- [ ] `:focus-visible` ring is visible
- [ ] First slide uses `<h1>`; subsequent section titles use `<h2>`
- [ ] Decorative SVGs have `aria-hidden="true"`

## I. Robustness

- [ ] No `eval`, no `new Function()` of untrusted input
- [ ] No `innerHTML` assignments of user data without escaping
- [ ] All event listeners either `passive: true` for scroll/touch or have `e.preventDefault()` documented
- [ ] JS errors logged but never thrown uncaught to the user
- [ ] Edit-mode persistence: changes saved to `localStorage` survive reload
- [ ] Edit-mode: edits do NOT persist across browsers/devices (acceptable — local-only is documented)

## J. Browser Compatibility

- [ ] Tested in Chrome latest
- [ ] Tested in Edge latest
- [ ] Tested in Safari latest (if Mac available; otherwise CSS is Safari-friendly: no `backdrop-filter` critical path, vendor prefixes where needed)

## K. Content Quality

- [ ] All slide titles match the outline approved in Phase 1
- [ ] Numbers, dates, names match source material — no invented facts
- [ ] Footer attribution (user-specified, if any) is present on cover and closing
- [ ] Disclaimers present where required (financial, medical, forward-looking statements)

---

## How to Run the Gate

1. Open the file in Chrome. Click through every slide. Watch for layout breaks.
2. Open DevTools console — must be empty of red errors.
3. Test keyboard nav from slide 1.
4. Resize window to 768px and 375px — check responsive behavior.
5. `Ctrl/Cmd + P` — verify print preview hides nav and lays out one slide per page.
6. Mark all checkboxes. Fix any unchecked items. Then declare done.

---

## QA Agent — How to Use This Checklist

You (the QA agent) read this file via the QA brief in `references/agent-roles.md`. Run every check by **actually reading the HTML file**, not by trusting `04-builder-notes.md`. Categorize each result:

- **PASS** — check verified by reading the HTML
- **PASS-WITH-NOTE** — passes the letter of the check but flag something minor
- **FAIL P0** — blocks delivery (broken layout, missing required feature, console error, broken navigation)
- **FAIL P1** — degrades experience but doesn't block (one missing transition, minor overflow)
- **FAIL P2** — nit / polish

Output `04-qa-report.md` with verdict (PASS / PASS-WITH-NOTES / FAIL) and per-check status. On FAIL, include a Defects section with each defect's severity, location, description, and suggested fix. The Director will route the defects back to the Builder.

Do NOT mark a check PASS just because the Builder's notes claim it was done. Verify independently. The Director may spot-check your work.