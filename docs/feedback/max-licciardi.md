# Feedback: Max Licciardi

**Date:** 2026-04-13  
**Context:** Early prototype demo — Max used it with wrong name and Feynman's Google Scholar but understood the concept

---

## UX / Data Sources

- **Add arXiv + bioRxiv** (and other preprints) as input sources — currently matching is limited to published work, CV, and project description. Preprints are where a lot of active research lives.
- If scraping preprints isn't feasible, allow upload of them.

---

## Architecture (Scale / Cost)

Current approach (web search per match) gets expensive at scale. Suggested direction:

1. **Index grant sites** — daily cron job scrapes title, description, eligibility etc. into DB
2. **Match within own infra** — run matching async against DB using cheaper model (Qwen etc.) for the bulk
3. **Web search as fallback** — Opus/equivalent only for sources the DB missed
4. **Result:** Much cheaper at scale, and enables push notifications / email list / subscription model

---

## Product / Market

- **Push notifications + email digest** for new matching grants — makes a subscription model make sense
- **Academic ↔ academic ↔ commercial matching** would be genuinely useful. Management/business school researchers are already ~50% state-funded consultants — linking to commercial funding makes the platform more VC-friendly.
- **Sell to university as a whole**, not individual academics — better unit economics
- Integration with **university SSO** + admin management layer is the right architecture
- **MoU from Exeter + Manchester + nice UI prototype** = enough for £100k+ VC/angel funding
- Max knows people at Manchester: **Ayham Fattoum** and **Nadia Papamichail**

---

## General

- Cost doesn't really matter pre ~100 users — current architecture is fine for prototype stage
- Worth sorting own infra as the product scales (Finn already saves scraped data, has some cron jobs)
- Would be keen to chat further, especially if looking at VC
