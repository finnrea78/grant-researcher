# Design: DB-Backed Semantic Opportunity Matching

**Date:** 2026-04-06  
**Status:** Approved

## Context

The grant-researcher app currently matches academics to funding opportunities by having a Claude agent read local `.md` files in `data/funding-sources/`. This doesn't scale — it can't query the Supabase opportunities table at all, and the table already has hundreds of rows from the ingest pipeline with thousands planned. The goal is to design for a database of tens of thousands of opportunities.

The goal is to replace local-file retrieval with a two-path DB retrieval system (pgvector cosine similarity + tsvector full-text search), feeding candidates to the existing Claude 5-dimension scorer. Designed for scale (tens of thousands of opportunities).

---

## Architecture Overview

```
Ingest pipeline
  └─ normalise opportunity
  └─ upsert to DB
  └─ compute embedding (OpenAI text-embedding-3-small)
  └─ store in opportunities.embedding

Enrich step (researcher)
  └─ Claude writes retrieval_summary (~400-word prose)
  └─ compute embedding from retrieval_summary
  └─ store in researchers.profile_embedding

Match route
  ├─ pgvector: cosine similarity → top 100 candidates
  ├─ tsvector: keyword query → top 100 candidates
  ├─ union + deduplicate → ~150 candidates
  ├─ pass as JSON context to Claude matcher agent
  ├─ Claude scores: 5-dimension (thematic, track record, strategic, practical, eligibility gate)
  └─ if Tier 1 < 3 → trigger Stage 2 focused web scan agent
```

---

## Section 1: Database Schema

### Migration: `db/migrations/YYYYMMDD_add_embeddings.sql`

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Semantic fingerprint of what each grant is about
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Full-text search — auto-maintained by Postgres, zero maintenance cost
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(scope, '') || ' ' ||
      coalesce(eligibility, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_opportunities_embedding
  ON opportunities USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_opportunities_fts
  ON opportunities USING gin (fts);

-- Cached researcher profile embedding (from Claude-generated prose summary)
ALTER TABLE researchers ADD COLUMN IF NOT EXISTS profile_embedding vector(1536);
```

**Why hnsw over ivfflat:** No training step needed, better query performance, works well from zero rows.

---

## Section 2: Ingest Pipeline

### New: `data-pipeline/src/lib/embedder.ts`

- Accepts opportunity, calls OpenAI `text-embedding-3-small` (1536 dims)
- Embedding text: `{name}. {description} {scope} {eligibility}` — concatenated, trimmed, truncated to ~8000 tokens
- Returns `number[]`
- Skips if `embedding` already populated and opportunity fields unchanged

### Updated: `data-pipeline/src/loaders/upsert-opportunities.ts`

- After successful upsert: if `embedding IS NULL`, call embedder and store vector

### New: `data-pipeline/src/commands/embed-backfill.ts` (`npm run embed`)

- Queries `WHERE embedding IS NULL`, batches 100 at a time, small delay between batches
- Reports: N embedded, N skipped

### Researcher profile embedding

- Computed at end of researcher-enricher agent run
- The enricher agent writes a `retrieval_summary` field: ~400-word coherent prose about the researcher's work, projects, publications, and direction — specifically optimised for semantic retrieval (NOT a keyword dump)
- New function in `src/lib/researcher-store.ts`: `updateProfileEmbedding(slug, summaryText)` — calls OpenAI, stores in `researchers.profile_embedding`
- Recomputed whenever `enriched_profile` is updated

**Why prose over keyword arrays:** Embedding models work better on natural language than concatenated arrays. A Claude-generated summary captures implicit connections (e.g. methodological affinities) that raw keywords miss.

---

## Section 3: Match Pipeline

### New: `src/lib/opportunity-retrieval.ts`

```typescript
export async function retrieveCandidates(
  researcherSlug: string,
  limit = 150
): Promise<Opportunity[]>
```

**pgvector path** (semantic similarity):
```sql
SELECT *, 1 - (embedding <=> $researcher_embedding) AS similarity
FROM opportunities
WHERE status = 'open' AND embedding IS NOT NULL
ORDER BY embedding <=> $researcher_embedding
LIMIT 100
```

**tsvector path** (keyword/belt-and-braces):
```sql
SELECT *, ts_rank(fts, query) AS rank
FROM opportunities, to_tsquery('english', $keyword_query) query
WHERE fts @@ query AND status = 'open'
ORDER BY rank DESC
LIMIT 100
```

tsvector query built from `research_themes + research_keywords` joined with `|` (OR — wide net). This is the "weird grants" safety net: catches niche opportunities that embed poorly but have specific matching terms.

**Union + deduplicate:** merge both result sets by `opportunity.id`, keep highest score, cap at 150.

**Fallback:** if `profile_embedding IS NULL`, skip pgvector and use tsvector only.

### Updated: `src/app/api/session/[name]/match/route.ts`

- Replace local `.md` file reading with `retrieveCandidates(name)`
- Pass candidates as JSON context to matcher agent: `{ opportunities, profile, proposalIntent? }`
- If Tier 1 results < 3 after scoring: trigger Stage 2 focused web scan agent

### Updated: `src/lib/prompts/matcher.ts`

- Remove `Read`/`Glob` file-reading instructions
- Receive candidates from provided JSON context
- `allowedTools`: remove `Read`, `Glob`, `Write` (candidates arrive in context, no file I/O needed)
- 5-dimension scoring logic unchanged

### Updated: `src/lib/prompts/researcher-enricher.ts`

- Add final step: generate `retrieval_summary` field — 400-word prose optimised for embedding

---

## Section 4: Testing (Red → Green)

### data-pipeline

**`embed-opportunity.test.ts`**
- builds correct concatenated text from opportunity fields
- truncates text above token limit
- skips embedding if already populated
- handles null description / scope / eligibility gracefully

**`embed-backfill.test.ts`**
- queries only `WHERE embedding IS NULL`
- processes in batches of 100
- reports embedded vs skipped count correctly

### src/

**`src/lib/__tests__/opportunity-retrieval.test.ts`** (new)
- pgvector query returns results ordered by similarity
- tsvector query returns results matching keywords
- union deduplicates by opportunity id
- filters to open opportunities only
- caps at 150 candidates
- falls back to tsvector-only when `profile_embedding` is null

**`src/app/api/session/[name]/match/` tests** (extend)
- calls `retrieveCandidates` before invoking agent
- passes candidates as context, not file paths
- triggers Stage 2 scan when Tier 1 < 3
- returns tiered matches in existing format

**OpenAI calls mocked** in all unit tests via Jest mock. Integration tests gated behind `INTEGRATION=true` env flag.

---

## Critical Files

| File | Change |
|------|--------|
| `db/migrations/YYYYMMDD_add_embeddings.sql` | New — pgvector, embedding columns, HNSW + GIN indexes |
| `data-pipeline/src/lib/embedder.ts` | New — OpenAI embedding helper |
| `data-pipeline/src/loaders/upsert-opportunities.ts` | Add embedding step post-upsert |
| `data-pipeline/src/commands/embed-backfill.ts` | New — backfill CLI command |
| `src/lib/opportunity-retrieval.ts` | New — dual retrieval + dedup |
| `src/lib/researcher-store.ts` | Add `updateProfileEmbedding()` |
| `src/lib/prompts/matcher.ts` | Remove file I/O, receive JSON context |
| `src/app/api/session/[name]/match/route.ts` | Replace file retrieval with `retrieveCandidates()` |
| `src/lib/prompts/researcher-enricher.ts` | Add `retrieval_summary` generation step |

---

## Verification

1. **Backfill:** `npm run embed -w data-pipeline` — confirm opportunities gain embedding vectors in Supabase
2. **Tests:** `npm run test:all` — all red-green tests pass
3. **End-to-end:** intake → enrich → match — verify candidates come from DB, tiered output renders correctly in UI
4. **Weird grants check:** manually verify a niche/unusual grant surfaces via tsvector fallback even if vector similarity score is low

---

## Implementation

Happens in a new git worktree branched from `main`.
