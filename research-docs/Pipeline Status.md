# Pipeline Status

> Related: [[Home]] | [[UK Grant Landscape]] | [[Free APIs]] | [[OpenAlex]]
> Codebase: `data-pipeline/` in the monorepo root

Current state of the `data-pipeline` package — what's built, what's working, what needs attention.

---

## Architecture Overview

```
CLI (src/cli.ts)
  └── ingest ukri-finder     → ukri-finder.ts   → NormalisedScheme → Supabase
  └── ingest gtr             → gtr.ts           → NormalisedScheme → Supabase
  └── ingest status          → reads ingestion_runs table
```

Entry point: `npm run -w data-pipeline ingest -- <subcommand>`

Each run: `startRun()` → fetch → normalise → `ensureFunders()` → `upsertSchemes()` → `completeRun()`

---

## Database Tables (Supabase)

| Table | Purpose |
|-------|---------|
| `funders` | Funding bodies (UKRI councils, etc.) — upserted by slug |
| `schemes` | Individual opportunities/awarded grants — upserted by `grant_reference` or `(funder_id, slug)` |
| `scheme_classifications` | Research topic tags (from GtR data) |
| `ingestion_runs` | Audit trail — source, status, records created/updated/skipped |
| `researchers` | Researcher profiles with intake data, ORCID, enrichment |

`amount_min`/`amount_max` are `bigint` (widened in migration 002).

---

## Source Connectors

### UKRI Funding Finder (`ukri-finder.ts`)
- **Status:** Working
- **What it does:** Scrapes `https://www.ukri.org/opportunity/` listing page with Cheerio
- **Output:** Open opportunities — title, URL, council, closing date, funding amount
- **Recent fix (merged 2026-04-05):** Deadline regex was broken — `[:\s]*` didn't match the word "date" in "Closing date:". Fixed to `\s+date`. Also added closing date extraction from detail pages as fallback.
- **Run:** `npm run -w data-pipeline ingest -- ukri-finder`
- **Run with council filter:** `npm run -w data-pipeline ingest -- ukri-finder --council ahrc`

### Gateway to Research (`gtr.ts`)
- **Status:** Working but intermittently unstable
- **What it does:** Paginates `https://gtr.ukri.org/gtr/api/projects` — awarded grants
- **Output:** Historical awarded projects with PI, institution, abstract, amount, publications
- **Known issue:** UKRI has marked the GtR API as "unsupported" (last docs update 2021) — causes occasional failures
- **500ms delay** between pages built in (polite use)
- **Run:** `npm run -w data-pipeline ingest -- gtr --council ahrc --limit 100 --since 2020`
- **Note:** `--since` and `--limit` flags exist in CLI config

---

## Transform Helpers

| File | Purpose |
|------|---------|
| `src/transforms/parse-amounts.ts` | Parses £ strings → `amount_min`, `amount_max` (bigint) |
| `src/transforms/parse-dates.ts` | Parses date strings → ISO `deadline_date` |
| `src/transforms/slugify.ts` | Generates URL-safe slugs for funder/scheme names |

---

## Normalised Schema

All sources normalise to `NormalisedScheme` (`src/types.ts`):

```typescript
interface NormalisedScheme {
  funder_slug: string;
  name: string;
  slug: string;
  status: string | null;
  deadline_raw: string | null;
  deadline_date: string | null;
  amount_raw: string | null;
  amount_min: number | null;        // bigint in DB
  amount_max: number | null;        // bigint in DB
  amount_currency: string;
  duration: string | null;
  career_stage: string | null;
  institutional_eligibility: string | null;
  thematic_priorities: string | null;
  application_process: string | null;
  url: string | null;
  grant_reference: string | null;
  source: "gtr" | "ukri_funding_finder" | "web_scrape";
  source_metadata: Record<string, unknown>;
  classifications: Classification[];
}
```

Adding a new source requires extending the `source` union and adding a new CLI subcommand.

---

## Known Issues / To-Do

| Issue | Priority | Notes |
|-------|----------|-------|
| GtR connector instability | Medium | API marked unsupported by UKRI; consider supplementing with [[OpenAlex]] for awarded grants |
| No charity funder scrapers | Medium | Wellcome, Leverhulme, British Academy etc. not yet ingested |
| No OpenAlex connector | Low | Would add awarded grants from 11.5M+ global grants; see [[OpenAlex]] |
| `awarded_grants` table | Low | GtR ingest deferred — `gtr` command exists but last run was incomplete |

---

## Verification Queries (Supabase)

```sql
-- Check deadline population
SELECT COUNT(*) FROM opportunities WHERE deadline_date IS NOT NULL;

-- Last 10 ingest runs
SELECT source, status, records_created, records_updated, started_at
FROM ingestion_runs ORDER BY started_at DESC LIMIT 10;

-- Opportunities by funder
SELECT f.name, COUNT(s.id) FROM schemes s
JOIN funders f ON f.id = s.funder_id
GROUP BY f.name ORDER BY COUNT DESC;
```
