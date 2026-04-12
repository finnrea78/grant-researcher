# Technical TODO — Grant Scout

Key technical tasks. Fill in as you go.

---

## Pipeline / Backend

- [ ] Simplify intake wizard — reduce friction for first-time users (see GitHub issue)
- [ ] Scheduled ingestion — cron/Railway job to keep UKRI opportunities fresh
- [ ] Add non-UKRI funders to data pipeline: Wellcome, Leverhulme, British Academy, Royal Society
- [ ] Enrich retrieval with `funder_name` in FTS RPC (`search_opportunities_fts`)

---

## Frontend

- [ ] Simplify intake wizard — fewer fields, smarter defaults, better mobile layout
- [ ] Add pagination / lazy loading for large match result sets
- [ ] Support filtering matches by funder, discipline, deadline window, career stage

---

## Data / Grants DB

- [ ] OpenAlex connector — awarded grants from 11.5M+ global records
- [ ] Historical award intelligence — funder fingerprint per scheme, success patterns
- [ ] Track open/close dates to build deadline pattern data
- [ ] Normalise and deduplicate across sources into unified `opportunities` table

---

## Infrastructure

- [ ] Rate limiting on pipeline API routes (per-session + per-IP)
- [ ] Prompt injection audit before public deployment (issue #16)
- [ ] Run `npm audit` in CI; pin critical dependencies
