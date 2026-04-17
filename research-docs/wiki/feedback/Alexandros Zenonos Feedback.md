---
date: 2026-04-14
type: user-feedback
contact: Alexandros Zenonos
context: First real beta test on production deploy — ran full pipeline, hit two bugs
---

# Alexandros Zenonos — Beta Test Feedback

## Bugs Found

- **Email confirmation redirect** — redirected to localhost instead of production URL (fixed same session)
- **Claude Code executable not found** on step 3 (retrieval summary): `ReferenceError: Claude Code executable not found at /app/node_modules/@anthropic-ai/claude-agent-sdk/cli.js` — Railway fallback hardening needed
- **Opportunity not found in DB** after matching: opportunity slug from match output not found in database — known bug, thought fixed

## UX & Product Feedback

- **Grant coverage** — UK only currently; EU has far more grants. Brexit barrier but worth solving.
- **Matching quality** — matched him on medical imaging despite no expertise. Filtering needs to be stricter as DB grows. Wants only a handful of highly relevant results, not broad matches.
- **CV data extraction** — needs verification step to confirm extraction was correct; CV links (e.g. to publications) should be followed for enrichment, but safely (avoid dangerous/untrusted links)
- **CV type** — should it be academic or general? Currently unclear.
- **Scholar page** — main scholar page doesn't say much; abstracts and actual papers are where the value is. Suggested adding **arXiv** (has unpublished work).
- **Pipeline resilience** — needs fallback options; not robust enough for production yet

## Architecture & Technical

- **Matching model** — could be a dedicated model rather than Claude deciding. Suggested mixture of experts (GPT, Gemini, Claude Opus) voting on most relevant grant — improves reliability and reduces bias.
- **Automated grant emails** — push relevant grants to users so they don't have to re-run the pipeline manually
- **EU grants** — Horizon Europe etc. are large and underserved; significant opportunity

## Business & Product Direction

- **Concept validated** — "the concept is actually good", "it's a nice personal project, I like it"
- **Free tier for individuals** — worthwhile to drive adoption before upselling to universities
- **B2B reverse angle** — companies/funders looking for the best researcher to give a grant to. Companies can pay; researchers are poor.
- **Open source question** — weighing open source vs. Exeter Innovation / startup route
- **Collaboration offer** — Alexandros offered to contribute features; also suggested mutual repo access (his AI Trends Radar ↔ Grant Scout)

## Alexandros's Project — AI Trends Radar

Building a trend radar for AI/ML signals with early detection focus.
- Sources: GitHub repos (star/fork velocity), newsletters, selected news feeds, paper citation rates
- Scoring formula: freshness, momentum, cross-source confirmation, source quality, strategic fit, durability, hype penalty
- Looking for collaborators / may open source
- Worth following up once more stable

---

> Related: [[User Feedback Index]] | [[Pipeline Status]] | [[Architecture]] | [[International]]
