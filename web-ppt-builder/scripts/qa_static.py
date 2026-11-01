#!/usr/bin/env python3
"""
qa_static.py - Static QA gate for web-ppt-builder output.

Runs without a browser. Catches the most common defects that Builder's self-report misses:
  - Missing required structural elements
  - Discontinuous slide data-index
  - data-action without handler
  - getElementById pointing to non-existent IDs
  - Unclosed <main> / <section> tags
  - Hex color literals outside :root / @media print (theme-token leakage)
  - JS brace / bracket imbalance
  - Backtick (template string) imbalance

Usage:
    python qa_static.py <path-to-html>

Exit codes:
    0 = PASS
    1 = FAIL (issues printed to stdout)
    2 = file not found
"""
import re
import sys
import os


REQUIRED_NEEDLES = [
    '<main',
    'class="controls"',
    'class="thumbs"',
    'class="click-zone click-zone-left"',
    'class="click-zone click-zone-right"',
    '@media print',
    '@media (prefers-reduced-motion',
    'role="navigation"',
    'role="main"',
    'aria-label',
    'goTo(',
    # —— 原始提示词契约（Prompt Contract）：五类必备页面 ——
    # 缺任意一类即视为结构不完整，QA 必须打回 Builder 重做。
    'data-slide="cover"',
    'data-slide="toc"',
    'data-slide="section"',
    'data-slide="content"',
    'data-slide="end"',
    # —— 原始提示词契约：交互与适配 ——
    'contenteditable',          # 编辑模式（在线改文案）
    'toggleTheme(',             # 深色 / 浅色切换
    'wheel',                    # 鼠标滚轮翻页
    '@media (max-aspect-ratio',  # 4:3 等比适配（非 16:9 屏不能溢出）
]

REQUIRED_FUNCTIONS = [
    'goTo(',
    'toggleFullscreen(',
    'toggleEdit(',
    'initCharts(',
    'applyEdits(',
    'persistEdits(',
    'loadFromHash(',
    'buildThumbs(',
    'toggleTheme(',   # 深浅色切换（原提示 5.2）
]

# SVG 动态图形：至少一种动效实现（原提示 2.4 要求 svg 动态图形、7.2 要求路径/数据流动画）
DYNAMIC_SVG_NEEDLES = ('<animate', 'stroke-dashoffset', 'stroke-dasharray')

# 中文注释下限（原提示 4.4「关键逻辑添加中文注释」）
MIN_CN_COMMENT_LINES = 8


def main():
    if len(sys.argv) < 2:
        print("Usage: qa_static.py <path-to-html>")
        sys.exit(2)

    path = sys.argv[1]
    if not os.path.isfile(path):
        print(f"FAIL: file not found: {path}")
        sys.exit(2)

    with open(path, 'r', encoding='utf-8') as f:
        html = f.read()
        content = html

    issues = []

    # 1. Required structural needles
    for needle in REQUIRED_NEEDLES:
        if needle not in html:
            issues.append(f"missing: {needle}")

    # 2. data-index continuity
    idxs = sorted(set(int(m.group(1)) for m in re.finditer(r'data-index="(\d+)"', html)))
    expected = list(range(1, len(idxs) + 1))
    if idxs != expected:
        issues.append(f"data-index not continuous: got {idxs}, expected {expected}")

    # 3. data-action handler mapping
    actions = set(m.group(1) for m in re.finditer(r'data-action="(\w+)"', html))
    js_handlers = set(re.findall(r"action === '(\w+)'", html))
    unmapped = actions - js_handlers
    if unmapped:
        issues.append(f"data-action has no handler: {unmapped}")

    # 4. getElementById ID presence
    js_ids = set(re.findall(r"getElementById\('(\w+)'\)", html))
    html_ids = set(re.findall(r'\bid="(\w+)"', html))
    missing = js_ids - html_ids
    if missing:
        issues.append(f"getElementById references missing IDs: {missing}")

    # 5. Tag balance
    if html.count('<main') != html.count('</main>'):
        issues.append("<main> not balanced")
    if html.count('<section') != html.count('</section>'):
        issues.append("<section> not balanced")

    # 6. Required functions defined
    for fn in REQUIRED_FUNCTIONS:
        if fn not in html:
            issues.append(f"function not defined: {fn}")

    # 7. Hex color leakage (outside :root and @media print blocks)
    # Strategy: find ranges that are inside :root{...} or @media print{...} and skip those lines.
    safe_ranges = []
    for m in re.finditer(r':root\s*\{', content):
        start = m.start()
        depth = 1
        i = m.end()
        while i < len(content) and depth > 0:
            if content[i] == '{': depth += 1
            elif content[i] == '}': depth -= 1
            i += 1
        safe_ranges.append((start, i))
    for m in re.finditer(r'@media[^{]*print\s*\{', content):
        start = m.start()
        depth = 1
        i = m.end()
        while i < len(content) and depth > 0:
            if content[i] == '{': depth += 1
            elif content[i] == '}': depth -= 1
            i += 1
        safe_ranges.append((start, i))

    def in_safe_range(pos):
        for (a, b) in safe_ranges:
            if a <= pos <= b:
                return True
        return False

    # Only flag CSS color/background values that are PURE hex (not mixed with var()):
    # Patterns: ": #abcdef" or ": #abcdef;" — must follow `: ` and NOT be inside `var(...)`
    hex_leaks = []
    for i, line in enumerate(html.split('\n'), 1):
        # Strip var(...) regions before checking
        stripped = re.sub(r'var\([^)]*\)', '', line)
        if re.search(r'(?:color|background|background-color|border-color):\s*#[0-9a-fA-F]{3,8}\b', stripped):
            line_start = sum(len(l) + 1 for l in html.split('\n')[:i - 1])
            if not in_safe_range(line_start):
                hex_leaks.append((i, line.strip()[:90]))
    if hex_leaks:
        issues.append(f"hex color leakage outside :root/print ({len(hex_leaks)} sites):")
        for ln, txt in hex_leaks[:5]:
            issues.append(f"  line {ln}: {txt}")

    # 8. JS brace balance (one inline script block)
    scripts = re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', html, re.DOTALL)
    for i, s in enumerate(scripts):
        op, cl = s.count('{'), s.count('}')
        if op != cl:
            issues.append(f"script block {i} brace mismatch: {{={op}, }}={cl}")

    # 9. Backtick (template string) balance
    backticks = html.count('`')
    if backticks % 2 != 0:
        issues.append(f"backtick count is odd: {backticks}")

    # 10. 原始提示词契约：五类必备页面都要有，且章节页至少 2 个
    kinds = {}
    for m in re.finditer(r'data-slide="(\w+)"', html):
        kinds[m.group(1)] = kinds.get(m.group(1), 0) + 1
    if kinds.get('section', 0) < 2:
        issues.append(
            f'章节标题页不足：data-slide="section" 只有 {kinds.get("section", 0)} 个，'
            f'原提示要求每章一页（章节序号 + 标题高亮 + 3~5 个要点）'
        )

    # 11. 当前页高亮（目录/缩略图/章节导航要用 aria-current 表达"我在哪"）
    if 'aria-current' not in html:
        issues.append('missing: aria-current（当前页/当前章节高亮）')

    # 12. 封面必备：日期 + 演讲者/团队
    cover = re.search(
        r'<section[^>]*data-slide="cover"[^>]*>(.*?)</section>', html, re.DOTALL)
    if cover:
        cover_html = cover.group(1)
        if not re.search(r'(20\d{2}\s*年|20\d{2}[-/]\d{1,2})', cover_html):
            issues.append('封面缺少日期信息（原提示 6.1）')
        if not re.search(r'(演讲|汇报|presenter|主讲|团队|by\s)', cover_html, re.I):
            issues.append('封面缺少演讲者/团队信息（原提示 6.1）')
    else:
        issues.append('missing: data-slide="cover"（封面页）')

    # 13. 封底必备：感谢语/号召语 + 联系方式或二维码
    end = re.search(
        r'<section[^>]*data-slide="end"[^>]*>(.*?)</section>', html, re.DOTALL)
    if end:
        end_html = end.group(1)
        if not re.search(r'(谢谢|感谢|Thank|欢迎讨论|期待)', end_html, re.I):
            issues.append('封底缺少感谢语/号召语（原提示 6.5）')
        if not re.search(r'(联系|邮箱|微信|电话|@|qr|二维码|qrcode)', end_html, re.I):
            issues.append('封底缺少联系方式或二维码（原提示 6.5）')
    else:
        issues.append('missing: data-slide="end"（封底页）')

    # 14. SVG 动态图形（不能只是静态图标/静态图表）
    if not any(needle in html for needle in DYNAMIC_SVG_NEEDLES):
        issues.append(
            '缺少 SVG 动态图形：需含 <animate> / stroke-dashoffset / stroke-dasharray 之一'
            '（原提示 2.4 / 7.2）'
        )

    # 15. 关键逻辑中文注释
    cn_comment_lines = 0
    for block in re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', html, re.DOTALL):
        for line in block.split('\n'):
            stripped = line.strip()
            if stripped.startswith('//') and re.search(r'[\u4e00-\u9fff]', stripped):
                cn_comment_lines += 1
            elif stripped.startswith('/*') and re.search(r'[\u4e00-\u9fff]', stripped):
                cn_comment_lines += 1
    if cn_comment_lines < MIN_CN_COMMENT_LINES:
        issues.append(
            f'JS 中文注释仅 {cn_comment_lines} 行，低于下限 {MIN_CN_COMMENT_LINES} 行'
            '（原提示 4.4）'
        )

    # 16. JS 页码条件必须指向真实存在的 data-index（防"插入章节页后 JS 条件错位"）
    # 事故原型：图表渲染写在 `if (current === 6)`，但该 chart 元素所在 slide 的
    # data-index 已重排为 9 —— 页面永远不渲染，且无任何报错。
    slides_by_idx = {}
    for m in re.finditer(r'<section\s[^>]*data-slide[^>]*>.*?</section>', html, re.DOTALL):
        dm = re.search(r'data-index="(\d+)"', m.group(0))
        if dm:
            slides_by_idx[int(dm.group(1))] = m.group(0)
    for n in set(re.findall(r'current\s*===\s*(\d+)', html)):
        if int(n) not in idxs:
            issues.append(
                f'JS 条件 current === {n} 没有对应的 data-index={n} 页面'
                '（页码重排后未同步，逻辑静默失效）'
            )
    # mkChart 触发条件所在页必须真的包含该 chart 容器
    for cond_n, chart_id in re.findall(
            r'current\s*===\s*(\d+)[^{}]*?\{\s*mkChart\(\s*[\'"]([\w-]+)[\'"]', html):
        slide = slides_by_idx.get(int(cond_n))
        target = re.search(rf'id=[\'"]{re.escape(chart_id)}[\'"]', html)
        if target and slide and f'id="{chart_id}"' not in slide:
            issues.append(
                f'mkChart(\'{chart_id}\') 挂在 current === {cond_n}，但该元素不在 '
                f'data-index={cond_n} 的页内（图表永不渲染）'
            )

    # Summary
    print(f"\n=== qa_static.py - {os.path.basename(path)} ===")
    if issues:
        print(f"FAIL: {len(issues)} issue(s):")
        for x in issues:
            print(f"  - {x}")
        sys.exit(1)
    print(f"PASS - all structural checks")
    print(f"   {len(idxs)} slides, {len(actions)} nav actions, {len(js_ids)} element IDs")
    sys.exit(0)


if __name__ == '__main__':
    main()