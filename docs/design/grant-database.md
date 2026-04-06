# Grant Database & Ingestion Pipeline — Design Spec

> Date: 2026-04-03
> Status: Draft
> Scope: Supabase grant database + ETL pipeline for GtR and UKRI Funding Finder

---

## Problem

Grant data is currently stored as markdown files on disk, scraped per-user session by Claude agents. This is:

- **Expensive** — agent + web fetch cost per scan
- **Slow** — minutes per session to re-scrape
- **Fragile** — URLs break, HTML changes
- **Redundant** — grant data doesn't change per user

## Solution

A Supabase (Postgres) database storing all grant data, populated by a standalone ingestion pipeline. The Next.js app queries the DB directly instead of reading markdown files.

## Scope

**In scope:**
- Supabase project setup and schema
- `data-pipeline/` monorepo workspace package
- GtR API connector (awarded grants, 173k+ projects)
- UKRI Funding Finder connector (open opportunities)
- CLI commands for manual and scriptable ingestion
- Ingestion run tracking and freshness auditing

**Out of scope (future):**
- Researcher profiles in DB (stays file-based for now)
- Match results in DB
- Auth / multi-user
- ORCID, 360Giving, or other source connectors
- Automated scheduling (cron / Edge Functions)

---

## Database Schema

### `funders`

Represents a funding body (AHRC, Leverhulme, Wellcome, etc.).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default gen_random_uuid() | |
| `slug` | text | UNIQUE, NOT NULL | URL-safe identifier, e.g. `ahrc` |
| `name` | text | NOT NULL | Display name |
| `website` | text | | Main funder URL |
| `type` | text | | `ukri_council`, `independent`, `international`, `charity` |
| `disciplines` | text[] | | Array of discipline slugs |
| `source_metadata` | jsonb | DEFAULT '{}' | Per-source extras (logo, org IDs, etc.) |
| `created_at` | timestamptz | DEFAULT now() | |
| `updated_at` | timestamptz | DEFAULT now() | |

### `schemes`

A specific funding scheme offered by a funder. Core table — one row per grant opportunity.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default gen_random_uuid() | |
| `funder_id` | uuid | FK → funders, NOT NULL | |
| `name` | text | NOT NULL | Scheme display name |
| `slug` | text | NOT NULL | URL-safe name |
| `status` | text | | `open`, `closed`, `upcoming`, `rolling`, `active_award`, `closed_award` |
| `deadline_raw` | text | | Original text ("8 May 2026, 4pm") |
| `deadline_date` | date | | Parsed date, nullable if TBC |
| `amount_raw` | text | | Original text ("Up to EUR 2.5 million") |
| `amount_min` | integer | | Parsed min in pence |
| `amount_max` | integer | | Parsed max in pence |
| `amount_currency` | text | DEFAULT 'GBP' | ISO currency code |
| `duration` | text | | Free text ("3-5 years") |
| `career_stage` | text | | Eligibility text (free text) |
| `institutional_eligibility` | text | | |
| `thematic_priorities` | text | | |
| `application_process` | text | | |
| `url` | text | | Direct link to scheme page |
| `grant_reference` | text | UNIQUE (nullable) | Formal ref for GtR grants (e.g. `AH/T001011/1`) |
| `source` | text | NOT NULL | `gtr`, `ukri_funding_finder`, `web_scrape` |
| `source_metadata` | jsonb | DEFAULT '{}' | Source-specific extras (GtR: abstract, PI name, outcomes, technical summary, impact text, project status) |
| `created_at` | timestamptz | DEFAULT now() | |
| `updated_at` | timestamptz | DEFAULT now() | |

**Unique constraint:** `UNIQUE(funder_id, slug)` — prevents duplicate schemes per funder.

**Indexes:**
- `idx_schemes_funder_id` on `funder_id`
- `idx_schemes_status` on `status`
- `idx_schemes_deadline_date` on `deadline_date`
- `idx_schemes_source` on `source`

### `scheme_classifications`

Research subject/topic classifications from GtR. Enables filtering by research area.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default gen_random_uuid() | |
| `scheme_id` | uuid | FK → schemes, ON DELETE CASCADE | |
| `type` | text | NOT NULL | `research_subject`, `research_topic`, `health_category`, `rcuk_programme` |
| `name` | text | NOT NULL | Classification name |
| `percentage` | integer | | GtR provides % allocation per classification |

**Index:** `idx_scheme_classifications_scheme_id` on `scheme_id`

### `ingestion_runs`

Audit trail for every ingestion attempt.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default gen_random_uuid() | |
| `source` | text | NOT NULL | `gtr`, `ukri_funding_finder` |
| `funder_slug` | text | | Nullable — null for full-source runs |
| `status` | text | NOT NULL | `running`, `success`, `failed`, `partial` |
| `records_created` | integer | DEFAULT 0 | |
| `records_updated` | integer | DEFAULT 0 | |
| `records_skipped` | integer | DEFAULT 0 | |
| `error_message` | text | | |
| `started_at` | timestamptz | DEFAULT now() | |
| `completed_at` | timestamptz | | |

---

## Ingestion Pipeline Package

### Location

New monorepo workspace: `data-pipeline/`

### Package structure

```
data-pipeline/
  package.json
  tsconfig.json
  src/
    db.ts                  # Supabase client (uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
    cli.ts                 # Commander CLI entry point
    sources/
      gtr.ts               # GtR API connector
      ukri-finder.ts       # UKRI Funding Finder HTML scraper
    transforms/
      normalise.ts         # Map source-specific data to scheme table shape
      parse-amounts.ts     # "Up to £2.5m" → { min, max, currency }
      parse-dates.ts       # "8 May 2026, 4pm" → Date | null
    loaders/
      upsert-grants.ts    # Supabase upsert with dedup logic
      log-run.ts           # Write ingestion_runs records
    types.ts               # Shared types (NormalisedScheme, SourceConfig, etc.)
```

### CLI commands

```bash
# Ingest awarded grants from GtR API
npm run -w data-pipeline ingest -- gtr --council ahrc --limit 500

# Ingest all UKRI councils from GtR
npm run -w data-pipeline ingest -- gtr --all

# Ingest open opportunities from UKRI Funding Finder
npm run -w data-pipeline ingest -- ukri-finder

# Ingest from all configured sources
npm run -w data-pipeline ingest -- all

# Check when each source was last ingested
npm run -w data-pipeline ingest -- status
```

### Dependencies

- `@supabase/supabase-js` — DB client
- `commander` — CLI framework (already used in core/)
- `cheerio` — HTML parsing for UKRI Funding Finder scraping
- `tsx` — TypeScript execution

---

## Source Connectors

### GtR API Connector

**Endpoint:** `https://gtr.ukri.org/search/project?term=...&page=N&fetchSize=100`

**Strategy:** Search by council name to get projects per UKRI funder. Paginate through all results.

**Data mapping:**

| GtR field | → DB column |
|---|---|
| `title` | `schemes.name` |
| `grantReference` | `schemes.grant_reference` |
| `status` | `schemes.status` (map Active → `active_award`, Closed → `closed_award`) |
| `fund.valuePounds` | `schemes.amount_min` and `amount_max` (same value) |
| `fund.start` | stored in `source_metadata` |
| `fund.end` | `schemes.deadline_date` (end of funding, not application deadline) |
| `fund.funder.name` | Lookup `funders.slug` |
| `abstractText` | `schemes.source_metadata.abstract` |
| `technicalSummary` | `schemes.source_metadata.technical_summary` |
| `potentialImpactText` | `schemes.source_metadata.impact_text` |
| `researchSubjects` | → `scheme_classifications` rows |
| `researchTopics` | → `scheme_classifications` rows |
| `healthCategories` | → `scheme_classifications` rows |
| PI name (from personRoles) | `schemes.source_metadata.pi_name` |
| Lead org (from composition) | `schemes.source_metadata.lead_organisation` |

**Dedup key:** `grant_reference` (unique per GtR project)

**Rate limiting:** No formal limit documented. Use 500ms delay between pages. Fetch overnight if doing full corpus.

### UKRI Funding Finder Connector

**Endpoint:** `https://www.ukri.org/opportunity/`

**Strategy:** Fetch the listing page, parse each opportunity card. Optionally filter by council via URL params.

**Data mapping:**

| HTML field | → DB column |
|---|---|
| Opportunity title | `schemes.name` |
| Council tag | Lookup `funders.slug` |
| Closing date | `schemes.deadline_raw` + parsed `deadline_date` |
| Funding amount | `schemes.amount_raw` + parsed `amount_min`/`amount_max` |
| Link to opportunity | `schemes.url` |
| Status badge | `schemes.status` |

**Dedup key:** `(funder_id, slug)` — generated from title and council.

---

## Supabase Setup

### Project creation

1. Create Supabase project at https://supabase.com/dashboard
2. Note the project URL and service role key

### Environment variables

Add to `.env.local`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...        # for frontend (later)
SUPABASE_SERVICE_ROLE_KEY=eyJ... # for data-pipeline (server-side only)
```

### Migration

SQL migration file at `data-pipeline/supabase/migrations/001_grant_schema.sql` containing all CREATE TABLE statements, indexes, and constraints from the schema above.

Run via Supabase CLI: `supabase db push` or apply through the dashboard SQL editor.

### Row-Level Security (RLS)

For the grants-only scope, RLS is simple:

- `funders`: public read, no write from frontend
- `schemes`: public read, no write from frontend
- `scheme_classifications`: public read, no write from frontend
- `ingestion_runs`: no frontend access

All writes happen via the service role key in the data-pipeline package.

---

## How the App Consumes the DB

The matcher currently reads all `funding-sources/*.md` files. With the DB, it queries Supabase instead:

```typescript
const { data: schemes } = await supabase
  .from('schemes')
  .select(`
    *,
    funder:funders(*),
    classifications:scheme_classifications(*)
  `)
  .in('status', ['open', 'rolling', 'upcoming'])
  .order('deadline_date', { ascending: true })
```

This replaces the scan stage for DB-sourced grants entirely. The matcher prompt receives structured JSON from the DB instead of markdown.

**Note:** The app migration (swapping file reads for DB queries) is a separate piece of work. This spec covers only the DB setup and ingestion pipeline.

---

## Verification

### Database
- [ ] Tables created in Supabase with correct columns and constraints
- [ ] Indexes present on key query columns
- [ ] RLS policies applied

### GtR ingestion
- [ ] `npm run -w data-pipeline ingest -- gtr --council ahrc --limit 10` writes rows to `schemes` and `scheme_classifications`
- [ ] Running the same command again updates existing rows (upsert, not duplicate)
- [ ] `ingestion_runs` row created with correct counts

### UKRI Funding Finder ingestion
- [ ] `npm run -w data-pipeline ingest -- ukri-finder` scrapes open opportunities and writes to `schemes`
- [ ] Deadlines are parsed correctly where possible
- [ ] Deduplication works on `(funder_id, slug)`

### Status command
- [ ] `npm run -w data-pipeline ingest -- status` shows last run time and recor d counts per source
