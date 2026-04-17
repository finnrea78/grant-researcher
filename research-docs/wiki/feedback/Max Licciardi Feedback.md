---
date: 2026-04-13
type: user-feedback
contact: Max Licciardi
context: Early prototype demo — Max used it with wrong name and Feynman's Google Scholar but understood the concept
---

# Max Licciardi — Early Feedback

## UX & Data Sources

- **Add arXiv + bioRxiv** as input sources — preprints are where a lot of active research lives; matching limited to published work misses this
- If scraping preprints isn't feasible, allow direct upload

## Architecture (Scale & Cost)

Current per-match web search gets expensive at scale. Recommended direction:

1. **Index grant sites** — daily cron scrapes title, description, eligibility into DB
2. **Match within own infra** — async against DB using cheaper model (Qwen etc.) for bulk matching
3. **Web search as fallback** — Opus/equivalent only for sources the DB missed
4. Result: much cheaper at scale; enables push notifications + subscription model

## Product & Market

- **Push notifications + email digest** for newly matched grants → makes a subscription model make sense
- **Academic ↔ academic ↔ commercial matching** is genuinely useful — management/business school researchers are ~50% state-funded consultants; linking commercial funding makes platform more VC-friendly
- **Sell to university as whole**, not individual academics — better unit economics
- University SSO + admin management layer is the right long-term architecture
- **MoU from Exeter + Manchester + nice UI prototype** = enough for £100k+ VC/angel funding

## Funding Path

- Max is keen to chat further, especially if looking at VC
- He knows people at Manchester: **Ayham Fattoum** and **Nadia Papamichail** — worth reaching out

## General

- Cost doesn't really matter pre ~100 users — current architecture is fine for prototype stage
- Worth sorting own infra as the product scales

---

> Related: [[User Feedback Index]] | [[Architecture]] | [[UK Grant Landscape]]
