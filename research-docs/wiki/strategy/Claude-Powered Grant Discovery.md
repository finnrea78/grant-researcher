# Claude-Powered Grant Discovery

> Related: [[Pipeline Status]] | [[Data Sources & APIs]] | [[Grant Ingestion CLI]]

The idea: instead of (or alongside) hardcoded scrapers, run Claude in a loop to autonomously find grants and ingest them into Supabase. Claude reads pages for *meaning*, not CSS selectors — far more resilient.

---

## The Problem with Current Scrapers

- Brittle: break on any HTML change; each site needs its own extractor
- Narrow coverage: only sources someone has manually scripted
- Poor yield: many scrapers return sparse data (amounts, deadlines often missing)
- High maintenance: need updating when sites change

---

## The Proposed Architecture

```
Seed (funder URLs or search queries)
  → Claude fetches pages (WebFetch)
  → Claude extracts structured grants (using NormalisedScheme schema)
  → Validate + deduplicate
  → Upsert to Supabase (existing loaders)
```

Claude replaces the Fetch + Normalise steps. The Load step (existing loaders) stays unchanged.

---

## Three Modes

### Mode 1: Targeted Extraction
Give Claude a list of known funder URLs (from [[Data Sources & APIs]]). It fetches each page and extracts all open grants it finds. No more per-site scraper code — one prompt handles all sites.

**Good for:** replacing fragile scrapers for Wellcome, Leverhulme, British Academy, etc.

### Mode 2: Discovery
Give Claude a search query ("UK humanities research grants 2026"). It searches, finds grant pages, extracts from each. Discovers sources beyond the seeded list.

**Good for:** the long tail of small trusts and bodies we haven't found yet.

### Mode 3: Hybrid (recommended starting point)
Seed URLs from the existing `_urls.md` list + Charity Commission register + known aggregators. Claude fetches and extracts. Occasionally run discovery queries to find new sources.

---

## What a Claude Loop Run Looks Like

```
1. Load seed funder list from DB or flat file
2. For each funder URL:
   a. WebFetch the opportunities page
   b. Prompt: "Extract all open grant opportunities from this page.
      Return JSON array matching NormalisedScheme. If a field is absent, use null."
   c. Validate the JSON (zod schema)
   d. For each grant with a detail URL, optionally fetch and enrich
   e. Upsert via existing loaders
3. Log run to ingestion_runs
4. Sleep until next cycle
```

---

## Ralph Loop vs Scheduled Trigger

| Approach | Pros | Cons |
|----------|------|------|
| **Ralph loop (interactive)** | Easy to start; can watch it run; good for dev | Requires a terminal open; not truly autonomous |
| **Scheduled remote trigger** | Runs unattended on cron; survives machine sleep | Harder to debug; needs deployment |

For production: use a scheduled trigger (see `schedule` skill) on a daily or weekly cadence.
For development/exploration: ralph loop is fine to iterate fast.

---

## Data Quality Controls

Claude can hallucinate. Mitigations:

1. **Zod validation** — reject any output that doesn't match `NormalisedScheme`; log failures
2. **URL verification** — only store grants where the source URL is real and fetchable
3. **Confidence field** — add a `discovery_confidence` enum to `NormalisedScheme`: `scraped | ai_extracted | ai_discovered`
4. **Review queue** — `ai_discovered` grants go into a pending state; surface in admin UI before publishing to researchers
5. **Deduplication** — existing upsert by `(funder_id, slug)` handles re-runs; slug derived from title + funder

---

## Subscription vs API Tokens

The existing pipeline agents already use `@anthropic-ai/claude-agent-sdk`, which routes through the Claude subscription locally — no API tokens. This discovery loop should do the same.

| Deployment | SDK | Cost |
|---|---|---|
| Local CLI / ralph loop | `claude-agent-sdk` (subscription) | Free |
| Cron on local machine | `claude-agent-sdk` (subscription) | Free |
| Scheduled trigger on Railway | `@anthropic-ai/sdk` (API tokens) | ~$1–2/week |

**Start with the agent SDK** (same as the rest of the pipeline). Only switch to the API SDK if you move scheduling to Railway.

The agent SDK session needs `web_fetch` (and optionally `web_search`) tools — Claude Code provides these. The extraction loop becomes:
```
claude-agent-sdk session → web_fetch funder page → extract NormalisedScheme JSON → upsert
```

---

## Advantages Over Scraper Loop

The existing ralph loop *creates* scrapers. This approach *replaces* them:

| | Scraper creation loop | Claude extraction loop |
|--|----------------------|----------------------|
| Output | Scraper code | Grant records in DB |
| Maintenance | Each scraper needs updating | One prompt handles all |
| Coverage | Manual — someone must add each source | Can self-discover |
| Failure mode | Silent (wrong selectors = no data) | Noisy (validation rejects bad output) |
| Speed to data | Slow (write → test → run cycle) | Fast (URL → DB in one step) |

---

## Implementation Path

1. **Phase 1 — Proof of concept**: single Claude call, hardcoded URL, validate output against zod, upsert
2. **Phase 2 — Loop over seed list**: iterate known funder URLs, log results
3. **Phase 3 — Discovery mode**: add search step to find new sources; write new URLs back to seed list
4. **Phase 4 — Schedule**: move to cron-triggered remote agent

Start with a new CLI command: `npm run ingest -w data-pipeline -- claude-discover --url <url>`

---

## Open Questions

- Should extracted grants be trusted immediately or go through a review queue?
- How to handle pagination (multiple pages of grants per funder)?
- Rate limiting: how fast can we hit funder sites without being blocked?
- Does the review queue need a UI, or is a Supabase query enough for now?
