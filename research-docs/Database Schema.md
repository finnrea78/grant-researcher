# Database Schema

Supabase (PostgreSQL + pgvector). Migrations in `db/supabase/migrations/`.  
Client: `db/src/client.ts` (lazy singleton). Types: `db/src/types.ts`.

## Tables

### `researchers`

Core researcher identity + profile.

| Column | Type | Notes |
|--------|------|-------|
| `slug` | text (PK) | URL-safe name |
| `name`, `email`, `institution` | text | |
| `career_stage` | text | ECR, mid-career, etc. |
| `research_themes`, `research_keywords`, `disciplinary_fields` | text[] | |
| `enriched_profile` | jsonb | `ResearcherProfile` JSON |
| `profile_embedding` | vector(1536) | OpenAI text-embedding-3-small |
| `funding_goals`, `collaboration`, `eligibility` | jsonb | from intake form |

### `funders`

Funder registry (seeded from `_urls.md`, enriched by scan agent).

| Column | Notes |
|--------|-------|
| `slug` (unique) | |
| `name`, `website`, `type` | |
| `disciplines` | text[] |
| `source_url`, `discovered_by`, `discovery_context` | agentic scan metadata |
| `last_harvested_at` | timestamp |

### `opportunities`

Open grant opportunities (live + scraped).

| Column | Notes |
|--------|-------|
| `funder_id` (FK → funders) | |
| `name`, `slug`, `status` | |
| `deadline_date` | date |
| `amount_min`, `amount_max` | bigint (pence) |
| `description`, `eligibility`, `scope` | text |
| `embedding` | vector(1536) |

### `awarded_grants`

Historical UKRI grants from Gateway to Research.

| Column | Notes |
|--------|-------|
| `funder_id` (FK) | |
| `grant_reference`, `name` | |
| `abstract`, `technical_summary`, `impact_text` | text |
| `amount` | bigint |
| `fund_start`, `fund_end` | date |
| `classifications` | jsonb (research subjects) |

### `researcher_proposals`

Saved proposal alignment docs per researcher/scheme.

| Column | Notes |
|--------|-------|
| `researcher_id` (FK) | |
| `funder_slug`, `scheme_slug` | |
| `content` | markdown text |
| RLS policy | researcher can only see/write their own |

### `ingestion_runs`

Audit trail for data-pipeline runs.

## Retrieval

See [[Retrieval Strategy]] for hybrid pgvector + tsvector query pattern.

## Key migrations

| File | What it adds |
|------|-------------|
| `..._grant_schema.sql` | funders, opportunities, awarded_grants, ingestion_runs |
| `..._researcher_schema.sql` | researchers table |
| `..._split_schemes.sql` | separate opportunities vs awarded_grants |
| `..._add_embeddings.sql` | pgvector columns on opportunities + researchers |
| `..._pipeline_state.sql` | pipeline run tracking |
| `..._researcher_auth.sql` | user auth links |
| `..._researcher_proposals_rls.sql` | researcher_proposals + RLS |

## RLS

- Opportunities: read-only for all authenticated users
- Researchers: row-level, user sees only their own record
- Proposals: row-level, user sees only their own

## Related

- [[Pipeline Agents]] · [[Retrieval Strategy]] · [[Grant Ingestion CLI]] · [[Codebase Index]]
