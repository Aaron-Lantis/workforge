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
]


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