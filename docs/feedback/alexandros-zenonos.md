# Feedback: Alexandros Zenonos

**Date:** 2026-04-14  
**Context:** Early beta test on production deploy — ran full pipeline, hit two bugs

---

## Bugs Found

- **Email confirmation redirect** — redirected to localhost instead of production URL (Finn fixed same session)
- **Claude Code executable not found** on step 3 (retrieval summary generation): `ReferenceError: Claude Code executable not found at /app/node_modules/@anthropic-ai/claude-agent-sdk/cli.js` — needs Railway fallback hardening
- **Opportunity not found in DB** after matching: `Error: Opportunity "large-scale-pilots-ai-genai-medical-imaging" from funder "digital-europe-programme" not found in database` — known bug, thought fixed

---

## UX / Product Feedback

- **Grant coverage** — only UK currently (find_a_grant + UKRI). Alexandros asked about EU; EU has far more grants. Brexit is a barrier but worth solving.
- **Matching quality** — matched him on medical imaging despite no expertise. Filtering needs to be stricter, especially as grant DB grows. Wants only a handful of highly relevant results, not broad matches.
- **CV data extraction** — needs verification step to confirm extraction was correct. Also: CV links (e.g. to publications) should be followed and used for enrichment, but safely (avoid dangerous/untrusted links).
- **CV type** — should it be academic or general? Currently unclear.
- **Scholar page** — main scholar page doesn't say much. Abstracts and actual papers are where the value is. Suggested adding arXiv (has unpublished work).
- **Pipeline resilience** — needs fallback options for better deployed behaviour; not robust enough for production yet.

---

## Architecture / Technical Suggestions

- **Matching model** — could be a dedicated model rather than Claude deciding. Suggested mixture of experts (GPT, Gemini, Claude Opus) voting on most relevant grant — would improve reliability and reduce bias.
- **Automated grant emails** — push relevant grants to users so they don't have to re-run the pipeline manually.
- **EU grants** — Horizon Europe etc. are large and underserved.

---

## Business / Product Direction

- **Concept validated** — "the concept is actually good", "it's a nice personal project, I like it"
- **Free tier for individuals** — worthwhile to drive adoption before upselling to universities
- **B2B angle** — also consider the reverse: companies/funders looking for the best researcher to give a grant to. Companies can pay; researchers are poor.
- **Open source question** — Alexandros asked; Finn is weighing open source vs. Exeter Innovation / startup route
- **Collaboration offer** — Alexandros offered to contribute features. Also suggested mutual repo access (his AI Trends Radar ↔ Grant Scout).

---

## Alexandros's Project — AI Trends Radar

Building a trend radar for AI/ML signals with early detection focus. Sources: GitHub repos (star/fork velocity), newsletters, selected news feeds, paper citation rates. Scoring formula includes freshness, momentum, cross-source confirmation, source quality, strategic fit, durability, and hype penalty. Looking for collaborators / may open source. Worth following up once more stable.
