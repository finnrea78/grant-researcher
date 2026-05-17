# Cost Architecture

> Related: [[Architecture Review Index]] | [[AI Pipeline Design]] | [[Data Model & Typed DB Spine]] | [[Claude-Powered Grant Discovery]] | [[Grant Ingestion CLI]]

The crux. The expensive thing (Sonnet agents discovering grants) and the cheap thing (a user getting matched) are currently the same pipeline. They are not.

## The principle

**Grant data is shared, slowly-changing reference data. Matching is per-user, on-demand.** Decouple:

> **Expensive shared-data production** — offline, batched, cheap/no model, cached.
> **Cheap per-user consumption** — query the DB; LLM only for final reasoning on a pre-filtered shortlist.

Agentic grant discovery becomes a scheduled batch job (cron worker, daily/weekly) writing to the shared `opportunities` table. One expensive crawl amortises across every user forever. It must **never** sit in a user request path. This is why the background worker is not optional — it is the cost firewall. See [[Refactor Plan — Steel Thread]].

## Tactics

- **Tier models ruthlessly.** Most "extraction" is parsing, not reasoning — cheerio/regex/structured selectors cost nothing. Haiku for bulk normalisation. Sonnet only for genuine reasoning (match scoring, proposal). A frontier model touching every scraped page is the cost bomb.
- **LLM is the last resort after cheap filters.** The hybrid pgvector + tsvector pre-filter (1000s → ~150 before Claude scores, see [[Retrieval Strategy]]) is the right instinct — push it further with eligibility/deadline/discipline filters before any token is spent. Batch what remains (score N schemes per prompt; batch embeddings).
- **Prompt caching is free money not being taken.** Rubric, instructions, static scaffold are identical across every call. Anthropic prompt caching on those is a large immediate cut — the repo's own `claude-api` skill mandates it. High ROI, low risk; do it early.
- **Dev/test loop must cost £0.** Record/replay LLM responses as fixture cassettes; a fake-model provider for tests; the eval harness on cached fixtures; Haiku in dev. Plus a hard per-day spend cap with a kill switch — non-negotiable before any public endpoint, and it doubles as the [[Security Findings]] P0-2 fix.

## Why this also answers "do I need AWS"

No. Cost efficiency here is an *architecture* decision (decouple + tier + cache + filter), not a *platform* decision. Moving to AWS/EKS adds burn rate and ops surface and fixes none of the above. See [[Deployment & Observability]].
