# Outline Schema

This is the contract between the Outline agent and downstream agents. The Builder reads this file to know what shape `02-outline.md` takes.

## File Structure

```markdown
# Slide Outline — <topic>

## Meta
- Topic: <主题>
- Audience: <受众>
- Core message: <核心信息>
- Style: <视觉风格>
- Color: <配色方案>
- Slide count: N
- Generated at: <ISO timestamp>

## Source materials
- <用户提供资料>
- <需要联网调研>

## Slide-by-slide outline

1. **Slide 1 — Role: Cover** — <title>
   - Layout hint: L01 (CenterStack)
   - Image: yes (ImageGen direction: <description>)
   - Chart: no
   - Key message: <一句话>
   - Content notes:
     - <要点1>
     - <要点2>
   - Decoration: <hero gradient + central motif>

2. **Slide 2 — Role: Agenda** — <title>
   - Layout hint: L19 (List/TOC)
   - Image: no
   - Chart: no
   - Key message: <章节列表>
   - Content notes:
     - 01 <章节1> — <一句话>
     - 02 <章节2> — <一句话>
   - Decoration: 顺序淡入图标

3. **Slide 3 — Role: SectionBreak** — 第一部分：<标题>
   - Layout hint: L03 (Center section break)
   - Image: no
   - Chart: no
   - Key message: 当前章节 + 序号大字号
   - Decoration: 深色变体 + 章节序号背景

4. **Slide 4 — Role: Concept+Visual** — <标题>
   - Layout hint: L05 (2col 50/50)
   - Image: yes (方向: <描述>)
   - Chart: no
   - Key message: <一个核心要点>
   - Content notes:
     - 左侧: <要点A>
     - 右侧: <要点B>
   - Decoration: 卡片玻璃

5. **Slide 5 — Role: 3Pillars** — <标题>
   - Layout hint: L07 (3col)
   - Image: no
   - Chart: no
   - Key message: 三大核心能力/特征
   - Content notes:
     - Pillar 1 — <描述>
     - Pillar 2 — <描述>
     - Pillar 3 — <描述>
   - Decoration: 三栏卡片，图标/数字

...

N. **Slide N — Role: Closing** — <感谢语 / 号召语>
   - Layout hint: L20 (CenterStack)
   - Image: yes (背景: <方向>)
   - Chart: no
   - Key message: 谢谢 / 联系方式
   - Content notes:
     - <感谢语>
     - 联系方式 / 二维码占位
   - Decoration: 与封面相同色板和母题，对称设计
```

## Role Vocabulary

Pick from these — `references/layout-catalog.md` defines each:

- `Cover` — full-screen title with hero treatment
- `Agenda` / `TOC` — section list with icons
- `SectionBreak` — chapter divider (full-screen chapter number + title)
- `Concept+Visual` — one concept, supporting visual (2col usually)
- `3Pillars` / `Features` — three or more parallel cards
- `Compare2` — two-column comparison
- `4col` / `Matrix4` — 2x2 grid of features or comparisons
- `Process` — sequential steps with arrows
- `Table` — structured tabular data
- `BigStat` — one giant statistic with context
- `StatsRow` — multiple stats in a row
- `Quote` — large pull quote
- `Timeline` — events on a horizontal timeline
- `Roadmap` — phased plan with milestones
- `KeyStatement` — single big takeaway
- `Closing` — thank-you / contact / call-to-action

## Layout Hint Vocabulary

Use the L01–L20 codes from `references/layout-catalog.md`. One hint per slide. Don't invent new codes.

## Visual Rhythm Rules

1. **Section break cadence**: Every 3–6 content pages, insert a `SectionBreak`.
2. **Image vs text balance**: Don't stack 5+ image-bearing pages in a row. Don't stack 5+ pure-text pages.
3. **Cover/closing symmetry**: Closing page uses the same color palette and motif family as the cover.
4. **Pacing**: After every 8–10 pages, drop in a `BigStat` or `Quote` to give the eye a rest.
5. **No two adjacent pages with the same role** unless they're a paired set (e.g. Compare2 left vs right).

## Self-Check Before Hand-off

Before writing `02-outline.md`, the Outline agent verifies:
- [ ] Every page has a role, layout hint, key message (or key data), decoration hint
- [ ] Slide count is within ±2 of the brief target
- [ ] Section breaks placed per rule 1
- [ ] Cover and closing share visual family (note explicitly in the cover decoration: "closes with mirror image on slide N")
- [ ] No consecutive pages with the same role
- [ ] Every page that needs data has at least one concrete number or named entity
- [ ] No page is purely decorative without delivering a message
- [ ] Total slide count fits in one reasonable session (~25 min presentation time at 60–90s/slide)

If any check fails, revise before writing.