# workforge

Reusable assets for AI-assisted presentation work — anchored by **web-ppt-builder**, a multi-agent pipeline that turns one natural-language brief into a polished, single-file HTML slide deck.

## Why this exists

Slide decks eat hours of fiddling: layout drift, broken charts, theme inconsistency, and "it looked fine on my machine" bugs. web-ppt-builder treats deck production as a software problem: five specialist agents (Requirements / Outline / Visual / Builder / QA) hand off through explicit contracts, and every deliverable must pass an automated quality gate before it ships.

## What's inside

| Path | What it is |
|------|------------|
| `web-ppt-builder/SKILL.md` | Skill entry point — director rules, phase pipeline, dispatch protocol |
| `web-ppt-builder/templates/` | Reference decks: complete, gate-passing HTML decks the agents consult as style & structure baselines |
| `web-ppt-builder/references/` | 8 dispatch briefs, engineering contract, 20-layout catalog, theme token system, QA checklist |
| `web-ppt-builder/scripts/` | Zero-dependency static QA gate (`qa_static.py`) |

### Highlights

- **Multi-agent pipeline** — Director + 5 specialists with a shared whiteboard and explicit hand-off contracts
- **Automated QA gate** — 25+ classes of structural defects caught without a browser (data-index continuity, handler mapping, theme-token leaks, JS brace balance)
- **Apple-HIG-inspired design system** — 7 theme recipes, layered shadows, a 10-step type ramp, safe entrance-animation rules
- **Reference templates** — real 15-page decks exercising the layout catalog (start with `templates/ai-agents-2026.html`)
- **Self-verifying** — every template must pass the same QA gate as user deliverables

## Quick start

1. Point your AI assistant at `web-ppt-builder/SKILL.md`.
2. Give it a natural-language brief — e.g. "a 15-page dark-tech deck on X for a technical review".
3. The pipeline runs Requirements → Outline → Visual → Build → QA and returns a single-file HTML deck.
4. Open the file in any browser: arrow keys navigate, `f` toggles fullscreen, the pen icon enters edit mode (edits persist locally).

Prefer working manually? Follow the walkthrough in [`web-ppt-builder/README.md`](./web-ppt-builder/README.md).

## Repository layout

```
workforge/
├── README.md
├── LICENSE                      # MIT
└── web-ppt-builder/             # the skill (self-contained, no external deps)
    ├── SKILL.md                 # entry point / director rules
    ├── templates/               # reference decks (gate-passing, ready to adapt)
    ├── references/              # briefs, contracts, design system
    └── scripts/                 # static QA gate
```

## Contributing

Issues and pull requests welcome — prefix the title with `[web-ppt-builder]`. New template submissions must pass `scripts/qa_static.py` and follow the token system in `references/css-variables.md`.

## License

MIT — see [LICENSE](./LICENSE).
