# DB-First Pipeline: Eliminate Filesystem State

**Date**: 2026-04-11
**Closes**: #52, #50, #44
**Related**: #45 (slug scoping), #55 (ownership verification)

## Problem

Pipeline state and outputs are stored on the local filesystem (`data/` directory). On Railway redeploy, all per-researcher state is wiped — matches vanish, pipeline progress resets, CVs disappear. 12 source files use `readFileSync`/`writeFileSync`/`existsSync` against `data/`. The `pipeline_state` JSONB column and `match_results_md`/`publications_md`/`scholar_candidate` columns already exist in the schema but are unused.

## Goal

Make Supabase the sole source of truth for all pipeline state and outputs. Remove all filesystem I/O from API routes. After this migration, the `data/` directory is no longer read or written by the Next.js app (the data-pipeline CLI may still use it for ingestion staging).

## Approach: Column-Centric Migration

Use existing schema columns on `researchers` table plus two new tables and a storage bucket.

---

## Schema Changes

### New table: `researcher_matches`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| researcher_id | uuid FK → researchers | NOT NULL |
| opportunity_id | uuid FK → opportunities | nullable (external matches) |
| funder_slug | text | NOT NULL |
| scheme_slug | text | NOT NULL |
| score_overall | numeric | NOT NULL |
| score_thematic | numeric | |
| score_track_record | numeric | |
| score_strategic | numeric | |
| score_practical | numeric | |
| eligible | boolean | DEFAULT true |
| tier | text | 'strong'/'moderate'/'weak'/'ineligible' |
| why | text | |
| strengths | text[] | |
| weaknesses | text[] | |
| action | text | |
| urgent | boolean | DEFAULT false |
| amount_raw | text | |
| deadline_raw | text | |
| url | text | |
| created_at | timestamptz | DEFAULT now() |

Constraints: `UNIQUE(researcher_id, funder_slug, scheme_slug)`
RLS: user-scoped via subquery on `researchers.user_id` (same pattern as `researcher_proposals`).

### New table: `funding_sources`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| slug | text UNIQUE | NOT NULL |
| name | text | NOT NULL |
| content_md | text | NOT NULL — the funder/scheme markdown |
| source_url | text | |
| discovered_at | timestamptz | DEFAULT now() |
| last_harvested | timestamptz | |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

RLS: public read.

### Supabase Storage bucket: `cv-uploads`

- Path: `{researcher_id}/cv.{pdf|md}`
- RLS: owner-scoped (read/write restricted to owning user)

### Existing columns (already in schema, just need wiring)

- `researchers.pipeline_state` (jsonb) — stage completion tracking
- `researchers.match_results_md` (text) — formatted matches markdown
- `researchers.publications_md` (text) — researcher context/publications
- `researchers.scholar_candidate` (jsonb) — ORCID disambiguation data

---

## Store Layer

### `src/lib/researcher-store.ts` (extend)

- `updatePipelineState(slug, patch)` — merge partial update into `pipeline_state` JSONB
- `getPipelineState(slug)` — read pipeline state for status route
- `updateScholarCandidate(slug, candidate | null)` — write/clear scholar_candidate
- `updatePublicationsMd(slug, md)` — write publications_md
- `updateMatchResultsMd(slug, markdown)` — write match_results_md

### `src/lib/match-store.ts` (new)

- `upsertMatch(researcherId, score)` — upsert single match
- `upsertMatchBatch(researcherId, scores)` — bulk upsert
- `getMatches(researcherId, options?)` — query with optional tier/sort
- `deleteMatchesForResearcher(researcherId)` — clean slate before re-match

### `src/lib/funding-source-store.ts` (new)

- `upsertFundingSource(source)` — upsert by slug
- `listFundingSources()` — all sources for scan agent
- `getFundingSource(slug)` — single source
- `getDiscoveredSources()` — replaces `_discovered.json`

### `src/lib/cv-store.ts` (new)

- `uploadCv(researcherId, file, contentType)` — upload to Supabase Storage
- `getCvUrl(researcherId)` — signed download URL
- `getCvText(researcherId)` — read cv_text column

---

## Route Rewiring

### `session/route.ts` (POST — create session)
- **Before**: writes `intake.json`, saves CV to `data/researchers/{name}/raw/`
- **After**: `upsertResearcher()` (existing), `uploadCv()`, `updatePipelineState(slug, { intake: true })`

### `session/[name]/intake/route.ts` (GET/PUT)
- **Before**: reads/writes `intake.json`, handles CV files, deletes markers on re-intake
- **After**: reads/writes `researchers` table, `cv-store` for CV, resets `pipeline_state` on re-intake

### `session/[name]/enrich/route.ts` (POST)
- **Before**: reads `intake.json`, writes ORCID data to `intake.json`, writes `_scholar-skip`
- **After**: reads from DB, `updateOrcidData()`, `updatePipelineState(slug, { enrich: 'complete' })` or `updateScholarCandidate()`

### `session/[name]/profile/route.ts` (POST)
- **Before**: reads `intake.json` + CV from disk, writes `profile.json` + `publications.md`
- **After**: reads from DB + `getCvText()`, `updateResearcherProfile()`, `updatePublicationsMd()`, `updatePipelineState(slug, { profile: true })`

### `session/[name]/scan/route.ts` (POST)
- **Before**: reads `profile.json` + funding source files, writes `_scan-complete` + `_discovered.json`
- **After**: reads `enriched_profile` from DB + `listFundingSources()`, `updatePipelineState(slug, { scan: true })`, `upsertFundingSource()` for new discoveries

### `session/[name]/match/route.ts` (POST)
- **Before**: agent writes score JSON files to disk, then formats `matches.md`
- **After**: agent returns structured JSON scores in text output, route parses and calls `upsertMatchBatch()`, `updateMatchResultsMd()`, `updatePipelineState(slug, { match: true })`

### `session/[name]/propose/route.ts` (POST)
- **Before**: agent writes proposal files, route reads them back
- **After**: captures agent output from streaming, writes to `researcher_proposals` table, updates `pipeline_state.proposals`

### `session/[name]/matches/route.ts` (GET)
- **Before**: reads `matches.md` from disk
- **After**: reads `match_results_md` from DB or queries `researcher_matches`

### `session/[name]/status/route.ts` (GET)
- **Before**: checks 6+ marker files on disk
- **After**: reads `pipeline_state` JSONB — single DB query

### `session/hydrate/route.ts` (POST)
- **Removed entirely** — no longer needed when routes read from DB directly

---

## Agent Tool Changes

| Agent | Remove | Reason |
|-------|--------|--------|
| Match | `Write` | Scores returned as structured JSON in agent output, not written to files |
| Propose | `Write` | Proposal content captured from streaming output |
| Scan | `Read`, `Glob` | Funding sources injected into prompt from DB |
| Profile | `Read` | CV text injected into prompt from `getCvText()` |
| Enrich | (none) | No file tools currently |

**Hard constraint preserved**: match route must never include `WebFetch` or `WebSearch` in `allowedTools`.

---

## Testing Strategy (TDD)

### Layer 1: Store functions
- Unit test each store function
- Assert correct Supabase queries and return shapes
- Test upsert idempotency, batch operations, null handling

### Layer 2: Route integration
- Test each route with mocked agent SDK
- Assert DB writes (not file writes) after route execution
- Assert correct pipeline_state transitions

### Layer 3: Pipeline state
- Status route returns correct state from JSONB
- State transitions are monotonic (can't go backward without explicit reset)
- Re-intake correctly resets downstream state

### Layer 4: Match scoring
- Structured score parsing from agent output
- Tier classification logic
- Batch upsert with conflict resolution

### Layer 5: Migration
- Schema applies cleanly on empty DB
- Constraints enforced (unique, foreign keys)
- RLS policies work correctly

---

## Files Modified

### New files
- `db/supabase/migrations/XXXXXX_researcher_matches.sql`
- `db/supabase/migrations/XXXXXX_funding_sources.sql`
- `src/lib/match-store.ts`
- `src/lib/funding-source-store.ts`
- `src/lib/cv-store.ts`
- `src/__tests__/match-store.test.ts`
- `src/__tests__/funding-source-store.test.ts`
- `src/__tests__/cv-store.test.ts`
- `src/__tests__/routes/*.test.ts` (per-route integration tests)

### Modified files
- `src/lib/researcher-store.ts` — add pipeline state + publications + scholar functions
- `src/app/api/session/route.ts` — remove fs writes, use store + cv-store
- `src/app/api/session/[name]/intake/route.ts` — remove fs I/O
- `src/app/api/session/[name]/enrich/route.ts` — remove fs I/O
- `src/app/api/session/[name]/profile/route.ts` — remove fs I/O
- `src/app/api/session/[name]/scan/route.ts` — remove fs I/O, use funding-source-store
- `src/app/api/session/[name]/match/route.ts` — remove fs I/O, use match-store
- `src/app/api/session/[name]/propose/route.ts` — remove fs I/O
- `src/app/api/session/[name]/matches/route.ts` — read from DB
- `src/app/api/session/[name]/status/route.ts` — read pipeline_state JSONB
- `src/lib/prompts/` — update agent prompts to remove file tool references
- `db/src/types.ts` — add `ResearcherMatchRow`, `FundingSourceRow` types

### Removed files
- `src/app/api/session/hydrate/route.ts` — no longer needed
- `src/lib/scan-persistence.ts` — replaced by funding-source-store
- `src/lib/proposalIntent.ts` — if only used for file-based scratch

---

## Verification

1. Run all new tests: `npm test` — all green
2. Start dev server: `npm run dev`
3. Create a new researcher session through the UI
4. Run full pipeline: profile → enrich → scan → match → propose
5. Verify matches persist across server restart
6. Verify status route shows correct pipeline state
7. Verify proposals load from DB
8. Confirm no reads/writes to `data/researchers/` or `data/outputs/` from routes
9. `grep -r "readFileSync\|writeFileSync\|existsSync\|mkdirSync" src/app/api/` should return no results
