# Opportunity Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace local `.md` file matching with hybrid pgvector + tsvector DB retrieval feeding the existing Claude 5-dimension scorer.

**Architecture:** At ingest, compute an OpenAI `text-embedding-3-small` vector for each opportunity and store it alongside a Postgres-generated `tsvector` column. At match time, run both retrieval paths in parallel, union/deduplicate up to 150 candidates, then pass them as JSON context to the existing Claude matcher agent. Researcher profile embedding is derived from a Claude-generated prose `retrieval_summary` written during the enrich step.

**Tech Stack:** Supabase pgvector, PostgreSQL tsvector/GIN, OpenAI `text-embedding-3-small`, Supabase JS client, Next.js 14 API routes, data-pipeline CLI (commander), Jest + ts-jest.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `db/supabase/migrations/20260406000001_add_embeddings.sql` | Create | pgvector extension, embedding columns, indexes, RPC functions |
| `data-pipeline/src/lib/embedder.ts` | Create | Build opportunity text + call OpenAI embeddings API |
| `data-pipeline/src/commands/embed-backfill.ts` | Create | Backfill missing opportunity embeddings |
| `data-pipeline/src/loaders/upsert-opportunities.ts` | Modify | Compute + store embedding after each upsert |
| `data-pipeline/src/cli.ts` | Modify | Register `embed` command |
| `data-pipeline/package.json` | Modify | Add `embed` script |
| `data-pipeline/tests/lib/embedder.test.ts` | Create | Tests for buildOpportunityText |
| `data-pipeline/tests/loaders/upsert-opportunities.test.ts` | Create | Tests for embedding-aware upsert |
| `data-pipeline/tests/commands/embed-backfill.test.ts` | Create | Tests for backfill logic |
| `src/lib/types.ts` | Modify | Add `retrieval_summary?` to `ResearcherProfile` |
| `src/lib/prompts/researcher-enricher.ts` | Modify | Add Step 6: generate retrieval_summary |
| `src/lib/embedder.ts` | Create | Thin OpenAI wrapper for Next.js app |
| `src/lib/researcher-store.ts` | Modify | Add `updateProfileEmbedding` + `getResearcherForMatching` |
| `src/lib/opportunity-retrieval.ts` | Create | Dual retrieval (pgvector + tsvector) + dedup |
| `src/app/api/session/[name]/enrich/route.ts` | Modify | Call updateProfileEmbedding after enrichment |
| `src/app/api/session/[name]/match/route.ts` | Modify | Use retrieveCandidates; fix params type; pass JSON context |
| `src/lib/prompts/matcher.ts` | Modify | Remove file-reading steps; read candidates from input JSON |
| `src/lib/__tests__/opportunity-retrieval.test.ts` | Create | Tests for dual retrieval + dedup |
| `src/lib/__tests__/researcher-store.test.ts` | Create | Tests for new store functions |

---

## Task 1: DB Migration

**Files:**
- Create: `db/supabase/migrations/20260406000001_add_embeddings.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- db/supabase/migrations/20260406000001_add_embeddings.sql

-- pgvector extension (already available on all Supabase projects)
CREATE EXTENSION IF NOT EXISTS vector;

-- Semantic embedding for each opportunity (computed at ingest time)
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Full-text search — generated column, auto-maintained by Postgres on every insert/update
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(scope, '') || ' ' ||
      coalesce(eligibility, ''))
  ) STORED;

-- HNSW index: approximate nearest-neighbor, no training step needed
CREATE INDEX IF NOT EXISTS idx_opportunities_embedding
  ON opportunities USING hnsw (embedding vector_cosine_ops);

-- GIN index for fast tsvector queries
CREATE INDEX IF NOT EXISTS idx_opportunities_fts
  ON opportunities USING gin (fts);

-- Researcher profile embedding (computed from Claude-generated retrieval_summary)
ALTER TABLE researchers ADD COLUMN IF NOT EXISTS profile_embedding vector(1536);

-- RPC: pgvector similarity search
-- Called from opportunity-retrieval.ts when researcher has a profile_embedding
CREATE OR REPLACE FUNCTION match_opportunities(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  funder_id uuid,
  name text,
  slug text,
  status text,
  description text,
  eligibility text,
  scope text,
  amount_raw text,
  amount_min bigint,
  amount_max bigint,
  amount_currency text,
  deadline_raw text,
  deadline_date date,
  url text,
  funding_type text,
  source text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, funder_id, name, slug, status,
    description, eligibility, scope,
    amount_raw, amount_min, amount_max, amount_currency,
    deadline_raw, deadline_date, url, funding_type, source,
    1 - (embedding <=> query_embedding) AS similarity
  FROM opportunities
  WHERE
    status = 'open'
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- RPC: tsvector full-text search with OR-joined keywords
-- Called from opportunity-retrieval.ts as belt-and-braces fallback
CREATE OR REPLACE FUNCTION search_opportunities_fts(
  search_query text,
  match_count int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  funder_id uuid,
  name text,
  slug text,
  status text,
  description text,
  eligibility text,
  scope text,
  amount_raw text,
  amount_min bigint,
  amount_max bigint,
  amount_currency text,
  deadline_raw text,
  deadline_date date,
  url text,
  funding_type text,
  source text,
  rank float4
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, funder_id, name, slug, status,
    description, eligibility, scope,
    amount_raw, amount_min, amount_max, amount_currency,
    deadline_raw, deadline_date, url, funding_type, source,
    ts_rank(fts, to_tsquery('english', search_query)) AS rank
  FROM opportunities
  WHERE
    status = 'open'
    AND fts IS NOT NULL
    AND fts @@ to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT match_count;
$$;
```

- [ ] **Step 2: Apply the migration**

Run in your Supabase SQL editor (or via `supabase db push` if using local CLI):
```
Open Supabase dashboard → SQL Editor → paste the migration → Run
```

Verify by running: `SELECT column_name FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name IN ('embedding', 'fts');` — should return 2 rows.

---

## Task 2: data-pipeline Embedder Module

**Files:**
- Create: `data-pipeline/src/lib/embedder.ts`
- Create: `data-pipeline/tests/lib/embedder.test.ts`

- [ ] **Step 1: Install openai in data-pipeline**

```bash
npm install openai -w data-pipeline
```

- [ ] **Step 2: Write the failing test**

```typescript
// data-pipeline/tests/lib/embedder.test.ts
import { buildOpportunityText } from "../../src/lib/embedder";

const MAX_CHARS = 32000;

describe("buildOpportunityText", () => {
  it("joins name, description, scope, eligibility with period-space", () => {
    const text = buildOpportunityText({
      name: "Research Grant",
      description: "Fund foundational research",
      scope: "Any discipline",
      eligibility: "Early career only",
    });
    expect(text).toContain("Research Grant");
    expect(text).toContain("Fund foundational research");
    expect(text).toContain("Any discipline");
    expect(text).toContain("Early career only");
  });

  it("omits null fields without leaving empty segments", () => {
    const text = buildOpportunityText({
      name: "Fellowship",
      description: null,
      scope: null,
      eligibility: null,
    });
    expect(text).toBe("Fellowship");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
  });

  it("omits empty string fields", () => {
    const text = buildOpportunityText({
      name: "Fellowship",
      description: "",
      scope: "STEM",
      eligibility: null,
    });
    expect(text).not.toContain(". ."); // no double separators
    expect(text).toContain("STEM");
  });

  it("truncates text exceeding MAX_CHARS", () => {
    const longText = "x".repeat(40000);
    const text = buildOpportunityText({
      name: longText,
      description: null,
      scope: null,
      eligibility: null,
    });
    expect(text.length).toBeLessThanOrEqual(MAX_CHARS);
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

```bash
npm test -w data-pipeline -- --testPathPattern=embedder
```

Expected: `FAIL — Cannot find module '../../src/lib/embedder'`

- [ ] **Step 4: Implement the embedder**

```typescript
// data-pipeline/src/lib/embedder.ts
import OpenAI from "openai";

const MAX_CHARS = 32000; // ~8000 tokens for text-embedding-3-small

export function buildOpportunityText(opp: {
  name: string;
  description: string | null;
  scope: string | null;
  eligibility: string | null;
}): string {
  return [opp.name, opp.description, opp.scope, opp.eligibility]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(". ")
    .slice(0, MAX_CHARS);
}

export async function embedText(text: string): Promise<number[]> {
  const client = new OpenAI(); // reads OPENAI_API_KEY from env
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
npm test -w data-pipeline -- --testPathPattern=embedder
```

Expected: `PASS — 4 tests pass`

- [ ] **Step 6: Commit**

```bash
git add data-pipeline/src/lib/embedder.ts data-pipeline/tests/lib/embedder.test.ts
git commit -m "feat(pipeline): add OpenAI embedding helper for opportunities"
```

---

## Task 3: Embed Opportunities on Ingest

**Files:**
- Modify: `data-pipeline/src/loaders/upsert-opportunities.ts`
- Create: `data-pipeline/tests/loaders/upsert-opportunities.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// data-pipeline/tests/loaders/upsert-opportunities.test.ts

// ─── Mock @grant-researcher/db ────────────────────────────────────────────────
const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
const mockSingle = jest.fn();
const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
const mockUpsert = jest.fn().mockReturnValue({ select: mockSelect });
const mockFrom = jest.fn().mockReturnValue({ upsert: mockUpsert, update: mockUpdate });

jest.mock("@grant-researcher/db", () => ({
  supabase: { from: mockFrom },
}));

// ─── Mock embedder ────────────────────────────────────────────────────────────
const mockBuildText = jest.fn().mockReturnValue("Grant text");
const mockEmbedText = jest.fn().mockResolvedValue(Array(1536).fill(0.1));

jest.mock("../../src/lib/embedder", () => ({
  buildOpportunityText: mockBuildText,
  embedText: mockEmbedText,
}));

import { upsertOpportunities } from "../../src/loaders/upsert-opportunities";
import type { NormalisedOpportunity } from "../../src/types";

const OPP: NormalisedOpportunity = {
  funder_slug: "ahrc",
  name: "Research Fellowship",
  slug: "research-fellowship",
  status: "open",
  deadline_raw: null,
  deadline_date: null,
  amount_raw: null,
  amount_min: null,
  amount_max: null,
  amount_currency: "GBP",
  url: null,
  funding_type: "fellowship",
  description: "A fellowship for researchers",
  eligibility: "UK HEI only",
  scope: "Arts and humanities",
  source: "ukri_funding_finder",
  source_metadata: {},
};

const FUNDER_MAP = new Map([["ahrc", { id: "funder-uuid", name: "AHRC" }]]);

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReturnValue({ upsert: mockUpsert, update: mockUpdate });
  mockUpsert.mockReturnValue({ select: mockSelect });
  mockUpdate.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
});

describe("upsertOpportunities with embedding", () => {
  it("calls embedText and stores embedding for a new opportunity (no existing embedding)", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "opp-uuid", created_at: "2026-01-01", updated_at: "2026-01-01", embedding: null },
      error: null,
    });

    await upsertOpportunities([OPP], FUNDER_MAP);

    expect(mockBuildText).toHaveBeenCalledWith(expect.objectContaining({ name: "Research Fellowship" }));
    expect(mockEmbedText).toHaveBeenCalledWith("Grant text");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("skips embedText if opportunity already has an embedding", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "opp-uuid", created_at: "2026-01-01", updated_at: "2026-01-01", embedding: Array(1536).fill(0.5) },
      error: null,
    });

    await upsertOpportunities([OPP], FUNDER_MAP);

    expect(mockEmbedText).not.toHaveBeenCalled();
  });

  it("skips embedding if upsert fails", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } });

    await upsertOpportunities([OPP], FUNDER_MAP);

    expect(mockEmbedText).not.toHaveBeenCalled();
  });

  it("skips funder not in funderMap without calling embedder", async () => {
    await upsertOpportunities([OPP], new Map());
    expect(mockEmbedText).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -w data-pipeline -- --testPathPattern=upsert-opportunities
```

Expected: `FAIL — embedText is not called`

- [ ] **Step 3: Update upsert-opportunities.ts**

```typescript
// data-pipeline/src/loaders/upsert-opportunities.ts
import { supabase } from "@grant-researcher/db";
import { buildOpportunityText, embedText } from "../lib/embedder.js";
import type { NormalisedOpportunity, RunCounters } from "../types.js";

export async function upsertOpportunities(
  opportunities: NormalisedOpportunity[],
  funderMap: Map<string, { id: string; name: string }>
): Promise<RunCounters> {
  const counters: RunCounters = { created: 0, updated: 0, skipped: 0 };

  for (const opp of opportunities) {
    const funderInfo = funderMap.get(opp.funder_slug);
    if (!funderInfo) {
      console.warn(`Skipping opportunity "${opp.name}": unknown funder slug "${opp.funder_slug}"`);
      counters.skipped++;
      continue;
    }

    const row = {
      funder_id: funderInfo.id,
      name: opp.name,
      slug: opp.slug,
      status: opp.status,
      deadline_raw: opp.deadline_raw,
      deadline_date: opp.deadline_date,
      amount_raw: opp.amount_raw,
      amount_min: opp.amount_min,
      amount_max: opp.amount_max,
      amount_currency: opp.amount_currency,
      url: opp.url,
      funding_type: opp.funding_type,
      description: opp.description,
      eligibility: opp.eligibility,
      scope: opp.scope,
      source: opp.source,
      source_metadata: opp.source_metadata,
    };

    const result = await supabase
      .from("opportunities")
      .upsert(row, { onConflict: "funder_id,slug" })
      .select("id, created_at, updated_at, embedding")
      .single();

    if (result.error) {
      if (result.error.code !== "23505") {
        console.error(`Failed to upsert opportunity "${opp.name}": ${result.error.message}`);
      }
      counters.skipped++;
      continue;
    }

    const wasCreated = result.data.created_at === result.data.updated_at;
    if (wasCreated) counters.created++;
    else counters.updated++;

    // Compute and store embedding only if not already present
    if (!result.data.embedding) {
      try {
        const text = buildOpportunityText(opp);
        const embedding = await embedText(text);
        await supabase
          .from("opportunities")
          .update({ embedding })
          .eq("id", result.data.id);
      } catch (err) {
        console.warn(`Failed to embed opportunity "${opp.name}": ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  return counters;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -w data-pipeline -- --testPathPattern=upsert-opportunities
```

Expected: `PASS — 4 tests pass`

- [ ] **Step 5: Commit**

```bash
git add data-pipeline/src/loaders/upsert-opportunities.ts data-pipeline/tests/loaders/upsert-opportunities.test.ts
git commit -m "feat(pipeline): embed opportunities on ingest"
```

---

## Task 4: Backfill Command

**Files:**
- Create: `data-pipeline/src/commands/embed-backfill.ts`
- Modify: `data-pipeline/src/cli.ts`
- Modify: `data-pipeline/package.json`
- Create: `data-pipeline/tests/commands/embed-backfill.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// data-pipeline/tests/commands/embed-backfill.test.ts

// ─── Mock @grant-researcher/db ────────────────────────────────────────────────
const mockLimit = jest.fn();
const mockRange = jest.fn().mockReturnValue({ data: [], error: null });
const mockIs = jest.fn().mockReturnValue({ limit: mockLimit });
const mockEq = jest.fn().mockReturnValue({ data: null, error: null });
const mockUpdateChain = { eq: mockEq };
const mockUpdate = jest.fn().mockReturnValue(mockUpdateChain);
const mockSelect = jest.fn().mockReturnValue({ is: mockIs });
const mockFrom = jest.fn();

jest.mock("@grant-researcher/db", () => ({
  supabase: { from: mockFrom },
}));

// ─── Mock embedder ────────────────────────────────────────────────────────────
const mockBuildText = jest.fn().mockReturnValue("opportunity text");
const mockEmbedText = jest.fn().mockResolvedValue(Array(1536).fill(0.2));

jest.mock("../../src/lib/embedder", () => ({
  buildOpportunityText: mockBuildText,
  embedText: mockEmbedText,
}));

import { embedBackfill } from "../../src/commands/embed-backfill";

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
  mockIs.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue({ data: [], error: null });
  mockEq.mockResolvedValue({ error: null });
});

describe("embedBackfill", () => {
  it("queries only opportunities WHERE embedding IS NULL", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    await embedBackfill({ batchSize: 100 });

    expect(mockFrom).toHaveBeenCalledWith("opportunities");
    expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining("id"));
    expect(mockIs).toHaveBeenCalledWith("embedding", null);
  });

  it("returns count of embedded and skipped (already had embedding)", async () => {
    // Simulate 2 opportunities without embeddings
    mockLimit.mockResolvedValueOnce({
      data: [
        { id: "opp-1", name: "Grant A", description: "Desc", scope: null, eligibility: null },
        { id: "opp-2", name: "Grant B", description: "Desc", scope: null, eligibility: null },
      ],
      error: null,
    });
    // Second batch empty (signals end)
    mockLimit.mockResolvedValue({ data: [], error: null });

    const { embedded, skipped } = await embedBackfill({ batchSize: 100 });

    expect(embedded).toBe(2);
    expect(skipped).toBe(0);
  });

  it("processes in batches of batchSize", async () => {
    const batch1 = Array.from({ length: 2 }, (_, i) => ({
      id: `opp-${i}`, name: `Grant ${i}`, description: null, scope: null, eligibility: null,
    }));
    mockLimit
      .mockResolvedValueOnce({ data: batch1, error: null })
      .mockResolvedValue({ data: [], error: null });

    await embedBackfill({ batchSize: 2 });

    // limit should have been called with batchSize
    expect(mockLimit).toHaveBeenCalledWith(2);
  });

  it("throws on Supabase query error", async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: "DB error" } });
    await expect(embedBackfill({ batchSize: 100 })).rejects.toThrow("DB error");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -w data-pipeline -- --testPathPattern=embed-backfill
```

Expected: `FAIL — Cannot find module '../../src/commands/embed-backfill'`

- [ ] **Step 3: Implement the backfill command**

```typescript
// data-pipeline/src/commands/embed-backfill.ts
import { supabase } from "@grant-researcher/db";
import { buildOpportunityText, embedText } from "../lib/embedder.js";

interface BackfillOptions {
  batchSize?: number;
}

interface BackfillResult {
  embedded: number;
  skipped: number;
}

export async function embedBackfill({ batchSize = 100 }: BackfillOptions = {}): Promise<BackfillResult> {
  let embedded = 0;
  let skipped = 0;

  while (true) {
    const { data, error } = await supabase
      .from("opportunities")
      .select("id, name, description, scope, eligibility")
      .is("embedding", null)
      .limit(batchSize);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    for (const opp of data) {
      try {
        const text = buildOpportunityText(opp);
        const embedding = await embedText(text);
        const { error: updateErr } = await supabase
          .from("opportunities")
          .update({ embedding })
          .eq("id", opp.id);
        if (updateErr) {
          console.warn(`Failed to store embedding for ${opp.id}: ${updateErr.message}`);
          skipped++;
        } else {
          embedded++;
        }
      } catch (err) {
        console.warn(`Failed to embed ${opp.name}: ${err instanceof Error ? err.message : err}`);
        skipped++;
      }
    }

    // If batch returned fewer than batchSize, we've processed all
    if (data.length < batchSize) break;
  }

  return { embedded, skipped };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -w data-pipeline -- --testPathPattern=embed-backfill
```

Expected: `PASS — 4 tests pass`

- [ ] **Step 5: Register the embed command in cli.ts**

Add before `program.parse()` at the bottom of `data-pipeline/src/cli.ts`:

```typescript
import { embedBackfill } from "./commands/embed-backfill.js";

// ... (add after existing commands, before program.parse())

program
  .command("embed")
  .description("Compute and store embeddings for all opportunities missing them")
  .option("--batch <n>", "Batch size (default 100)", parseInt)
  .action(async (opts) => {
    const batchSize = opts.batch ?? 100;
    console.log(`\nEmbedding opportunities (batch: ${batchSize})`);
    try {
      const { embedded, skipped } = await embedBackfill({ batchSize });
      console.log(`  Done: ${embedded} embedded, ${skipped} failed`);
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });
```

- [ ] **Step 6: Add embed script to data-pipeline/package.json**

In `data-pipeline/package.json`, update `"scripts"`:

```json
"scripts": {
  "ingest": "node --env-file=.env --import=tsx src/cli.ts",
  "embed": "node --env-file=.env --import=tsx src/cli.ts embed",
  "test": "jest"
}
```

- [ ] **Step 7: Commit**

```bash
git add data-pipeline/src/commands/embed-backfill.ts data-pipeline/src/cli.ts data-pipeline/package.json data-pipeline/tests/commands/embed-backfill.test.ts
git commit -m "feat(pipeline): add embed backfill command"
```

---

## Task 5: Researcher Profile — retrieval_summary Type + Enricher Prompt

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/prompts/researcher-enricher.ts`

- [ ] **Step 1: Add retrieval_summary to ResearcherProfile**

In `src/lib/types.ts`, add `retrieval_summary?` to `ResearcherProfile` after the existing enrichment fields:

```typescript
// Enrichment fields — added by the Enrich stage, not the profile agent
google_scholar_url?: string;
future_research?: string;
scholar_h_index?: number;
scholar_citation_count?: number;
retrieval_summary?: string; // Claude-generated prose for semantic embedding
```

- [ ] **Step 2: Add Step 6 to the enricher prompt**

In `src/lib/prompts/researcher-enricher.ts`, add before the closing backtick of `RESEARCHER_ENRICHER_PROMPT`:

```typescript
// After ### Step 5: Write researcher-context.md section, add:

`
### Step 6: Write retrieval_summary into profile.json

Read the current profile.json. Add a new field \`retrieval_summary\` — a single string of approximately 400 words written in natural, coherent prose.

This summary is used to compute a semantic embedding for grant matching. Write it to surface implicit connections and research affinities, NOT as a keyword dump.

Include:
- What the researcher actually studies (their core intellectual concerns, not just subject labels)
- Their key methodological approaches and theoretical frameworks
- The geographic, cultural, or thematic contexts of their work
- What their current projects are trying to achieve
- The trajectory of their career and where they are heading
- What kinds of funding and collaborations would suit them

Write in third-person, present tense. Be specific about their actual work, not generic. A good summary makes it possible to find funding opportunities that fit even if they use different terminology.

Example opening: "Dr [Name] is a [field] researcher at [institution] whose work centres on [specific topic]. Their current projects explore [specific angles]..."

Write the updated profile.json with this new field added (do not overwrite other fields).`
```

- [ ] **Step 3: Verify the prompt ends correctly**

Check that the backtick template literal still closes properly — the prompt must still end with `.trim()`.

- [ ] **Step 4: Run all tests to confirm nothing is broken**

```bash
npm test
```

Expected: All existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/prompts/researcher-enricher.ts
git commit -m "feat: add retrieval_summary to researcher profile for semantic embedding"
```

---

## Task 6: src Embedder + updateProfileEmbedding + getResearcherForMatching

**Files:**
- Create: `src/lib/embedder.ts`
- Modify: `src/lib/researcher-store.ts`
- Modify: `src/app/api/session/[name]/enrich/route.ts`
- Create: `src/lib/__tests__/researcher-store.test.ts`

- [ ] **Step 1: Install openai in the root (Next.js) package**

```bash
npm install openai
```

- [ ] **Step 2: Write the failing test for researcher-store new functions**

```typescript
// src/lib/__tests__/researcher-store.test.ts

// ─── Mock Supabase ────────────────────────────────────────────────────────────
function makeChain(resolveValue: unknown) {
  const c = {
    select: jest.fn(),
    eq: jest.fn(),
    update: jest.fn(),
    single: jest.fn(),
    then: jest.fn(),
  };
  c.select.mockReturnValue(c);
  c.eq.mockReturnValue(c);
  c.update.mockReturnValue(c);
  c.single.mockReturnValue(Promise.resolve(resolveValue));
  c.then.mockImplementation((resolve: (v: unknown) => void) => {
    resolve(resolveValue);
    return Promise.resolve(resolveValue);
  });
  return c;
}

const mockFrom = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

// ─── Mock src embedder ────────────────────────────────────────────────────────
const mockEmbedText = jest.fn().mockResolvedValue(Array(1536).fill(0.3));
jest.mock("@/lib/embedder", () => ({
  embedText: mockEmbedText,
}));

import { updateProfileEmbedding, getResearcherForMatching } from "@/lib/researcher-store";

let currentChain: ReturnType<typeof makeChain>;

function setupChain(resolveValue: unknown) {
  currentChain = makeChain(resolveValue);
  mockFrom.mockReturnValue(currentChain);
}

beforeEach(() => jest.clearAllMocks());

// ─── updateProfileEmbedding ───────────────────────────────────────────────────

describe("updateProfileEmbedding", () => {
  it("calls embedText with the summary and stores the result", async () => {
    setupChain({ error: null });

    await updateProfileEmbedding("jane-smith", "Jane studies marine acoustics...");

    expect(mockEmbedText).toHaveBeenCalledWith("Jane studies marine acoustics...");
    expect(mockFrom).toHaveBeenCalledWith("researchers");
    expect(currentChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ profile_embedding: Array(1536).fill(0.3) })
    );
  });

  it("throws when Supabase returns an error", async () => {
    setupChain({ error: { message: "Update failed" } });

    await expect(
      updateProfileEmbedding("jane-smith", "summary text")
    ).rejects.toThrow("Update failed");
  });
});

// ─── getResearcherForMatching ─────────────────────────────────────────────────

describe("getResearcherForMatching", () => {
  it("returns profile_embedding, research_themes, research_keywords", async () => {
    const fakeEmbedding = Array(1536).fill(0.5);
    setupChain({
      data: {
        profile_embedding: fakeEmbedding,
        research_themes: ["ecology", "climate"],
        research_keywords: ["marine", "carbon"],
      },
      error: null,
    });

    const result = await getResearcherForMatching("jane-smith");

    expect(mockFrom).toHaveBeenCalledWith("researchers");
    expect(result.profile_embedding).toEqual(fakeEmbedding);
    expect(result.research_themes).toEqual(["ecology", "climate"]);
    expect(result.research_keywords).toEqual(["marine", "carbon"]);
  });

  it("returns null profile_embedding when researcher has none", async () => {
    setupChain({
      data: { profile_embedding: null, research_themes: [], research_keywords: [] },
      error: null,
    });

    const result = await getResearcherForMatching("new-researcher");
    expect(result.profile_embedding).toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    setupChain({ data: null, error: { message: "Not found" } });
    await expect(getResearcherForMatching("ghost")).rejects.toThrow("Not found");
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

```bash
npm test -- --testPathPattern=researcher-store
```

Expected: `FAIL — Cannot find module '@/lib/embedder'`

- [ ] **Step 4: Create src/lib/embedder.ts**

```typescript
// src/lib/embedder.ts
// Server-only — only import in Next.js API routes, not client components.
import OpenAI from "openai";

export async function embedText(text: string): Promise<number[]> {
  const client = new OpenAI(); // reads OPENAI_API_KEY from env
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}
```

- [ ] **Step 5: Add updateProfileEmbedding and getResearcherForMatching to researcher-store.ts**

Append to the bottom of `src/lib/researcher-store.ts`:

```typescript
import { embedText } from "@/lib/embedder";

/**
 * Compute a semantic embedding from the researcher's Claude-generated
 * retrieval_summary and store it in researchers.profile_embedding.
 */
export async function updateProfileEmbedding(
  slug: string,
  summaryText: string
): Promise<void> {
  const profile_embedding = await embedText(summaryText);
  const { error } = await supabase
    .from("researchers")
    .update({ profile_embedding })
    .eq("slug", slug);
  if (error) {
    throw new Error(`Failed to update profile embedding for ${slug}: ${error.message}`);
  }
}

/**
 * Fetch only the fields needed for opportunity retrieval.
 */
export async function getResearcherForMatching(slug: string): Promise<{
  profile_embedding: number[] | null;
  research_themes: string[];
  research_keywords: string[];
}> {
  const { data, error } = await supabase
    .from("researchers")
    .select("profile_embedding, research_themes, research_keywords")
    .eq("slug", slug)
    .single();
  if (error) throw new Error(`Failed to fetch researcher ${slug}: ${error.message}`);
  return {
    profile_embedding: data.profile_embedding ?? null,
    research_themes: data.research_themes ?? [],
    research_keywords: data.research_keywords ?? [],
  };
}
```

- [ ] **Step 6: Run the test to confirm it passes**

```bash
npm test -- --testPathPattern=researcher-store
```

Expected: `PASS — 5 tests pass`

- [ ] **Step 7: Update the enrich route to compute profile embedding**

In `src/app/api/session/[name]/enrich/route.ts`, add the import and call at the bottom of the Supabase sync block:

```typescript
import { updateResearcherProfile, updateProfileEmbedding } from "@/lib/researcher-store";

// Inside the Supabase sync block, after updateResearcherProfile:
if (existsSync(profilePath)) {
  try {
    const profile = JSON.parse(readFileSync(profilePath, "utf-8")) as ResearcherProfile;
    await updateResearcherProfile(name, profile);

    // Compute and store profile embedding if retrieval_summary was written
    if (profile.retrieval_summary) {
      await updateProfileEmbedding(name, profile.retrieval_summary);
    }
  } catch (syncErr) {
    console.error(`[enrich] Supabase sync failed for ${name}:`, syncErr);
  }
}
```

- [ ] **Step 8: Run all tests to confirm nothing is broken**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/embedder.ts src/lib/researcher-store.ts src/app/api/session/[name]/enrich/route.ts src/lib/__tests__/researcher-store.test.ts
git commit -m "feat: compute and store researcher profile embedding after enrichment"
```

---

## Task 7: Opportunity Retrieval Module

**Files:**
- Create: `src/lib/opportunity-retrieval.ts`
- Create: `src/lib/__tests__/opportunity-retrieval.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/opportunity-retrieval.test.ts

// ─── Mock Supabase ────────────────────────────────────────────────────────────
const mockRpc = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { rpc: mockRpc },
}));

// ─── Mock researcher-store ────────────────────────────────────────────────────
const mockGetResearcher = jest.fn();
jest.mock("@/lib/researcher-store", () => ({
  getResearcherForMatching: mockGetResearcher,
}));

import { retrieveCandidates } from "@/lib/opportunity-retrieval";

const FAKE_EMBEDDING = Array(1536).fill(0.1);

const VECTOR_OPP = {
  id: "opp-1", funder_id: "f-1", name: "Ecology Grant", slug: "ecology-grant",
  status: "open", description: "Fund ecology research", eligibility: null,
  scope: "Environment", amount_raw: null, amount_min: null, amount_max: null,
  amount_currency: "GBP", deadline_raw: null, deadline_date: null,
  url: null, funding_type: "grant", source: "ukri_funding_finder", similarity: 0.8,
};

const FTS_OPP = {
  id: "opp-2", funder_id: "f-2", name: "Climate Fellowship", slug: "climate-fellowship",
  status: "open", description: null, eligibility: null, scope: null,
  amount_raw: null, amount_min: null, amount_max: null, amount_currency: "GBP",
  deadline_raw: null, deadline_date: null, url: null, funding_type: "fellowship",
  source: "wellcome", rank: 0.5,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("retrieveCandidates", () => {
  it("runs both pgvector and tsvector paths when profile_embedding exists", async () => {
    mockGetResearcher.mockResolvedValue({
      profile_embedding: FAKE_EMBEDDING,
      research_themes: ["ecology"],
      research_keywords: ["climate"],
    });
    mockRpc
      .mockResolvedValueOnce({ data: [VECTOR_OPP], error: null }) // match_opportunities
      .mockResolvedValueOnce({ data: [FTS_OPP], error: null });   // search_opportunities_fts

    const results = await retrieveCandidates("jane-smith");

    expect(mockRpc).toHaveBeenCalledWith("match_opportunities", expect.objectContaining({
      query_embedding: FAKE_EMBEDDING,
    }));
    expect(mockRpc).toHaveBeenCalledWith("search_opportunities_fts", expect.objectContaining({
      search_query: expect.stringContaining("|"),
    }));
    expect(results).toHaveLength(2);
  });

  it("deduplicates by id when both paths return the same opportunity", async () => {
    mockGetResearcher.mockResolvedValue({
      profile_embedding: FAKE_EMBEDDING,
      research_themes: ["ecology"],
      research_keywords: [],
    });
    const DUPLICATE = { ...FTS_OPP, id: "opp-1" }; // same id as VECTOR_OPP
    mockRpc
      .mockResolvedValueOnce({ data: [VECTOR_OPP], error: null })
      .mockResolvedValueOnce({ data: [DUPLICATE], error: null });

    const results = await retrieveCandidates("jane-smith");

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("opp-1");
  });

  it("falls back to tsvector-only when profile_embedding is null", async () => {
    mockGetResearcher.mockResolvedValue({
      profile_embedding: null,
      research_themes: ["marine"],
      research_keywords: ["acoustics"],
    });
    mockRpc.mockResolvedValueOnce({ data: [FTS_OPP], error: null });

    const results = await retrieveCandidates("jane-smith");

    // Only one rpc call (fts only)
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("search_opportunities_fts", expect.any(Object));
    expect(results).toHaveLength(1);
  });

  it("caps results at provided limit", async () => {
    mockGetResearcher.mockResolvedValue({
      profile_embedding: null,
      research_themes: ["ecology"],
      research_keywords: [],
    });
    const manyOpps = Array.from({ length: 200 }, (_, i) => ({ ...FTS_OPP, id: `opp-${i}` }));
    mockRpc.mockResolvedValueOnce({ data: manyOpps, error: null });

    const results = await retrieveCandidates("jane-smith", 50);
    expect(results.length).toBeLessThanOrEqual(50);
  });

  it("returns empty array when both paths return no results", async () => {
    mockGetResearcher.mockResolvedValue({
      profile_embedding: null,
      research_themes: [],
      research_keywords: [],
    });
    mockRpc.mockResolvedValueOnce({ data: [], error: null });

    const results = await retrieveCandidates("jane-smith");
    expect(results).toEqual([]);
  });

  it("throws when researcher fetch fails", async () => {
    mockGetResearcher.mockRejectedValue(new Error("Not found"));
    await expect(retrieveCandidates("ghost")).rejects.toThrow("Not found");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npm test -- --testPathPattern=opportunity-retrieval
```

Expected: `FAIL — Cannot find module '@/lib/opportunity-retrieval'`

- [ ] **Step 3: Implement opportunity-retrieval.ts**

```typescript
// src/lib/opportunity-retrieval.ts
// Server-only — only import in Next.js API routes.
import { supabase } from "@/lib/supabase";
import { getResearcherForMatching } from "@/lib/researcher-store";

export interface CandidateOpportunity {
  id: string;
  funder_id: string;
  name: string;
  slug: string;
  status: string | null;
  description: string | null;
  eligibility: string | null;
  scope: string | null;
  amount_raw: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_currency: string;
  deadline_raw: string | null;
  deadline_date: string | null;
  url: string | null;
  funding_type: string | null;
  source: string;
}

/**
 * Build a to_tsquery-compatible OR string from researcher terms.
 * Each multi-word term is split into individual words joined with |.
 * Example: ["climate change", "marine"] → "climate | change | marine"
 */
export function buildTsquery(themes: string[], keywords: string[]): string {
  const words = [...themes, ...keywords]
    .flatMap((t) => t.toLowerCase().split(/\s+/))
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 2);
  const unique = [...new Set(words)];
  return unique.join(" | ");
}

/**
 * Retrieve up to `limit` candidate opportunities using hybrid retrieval:
 * 1. pgvector cosine similarity (if researcher has profile_embedding)
 * 2. tsvector full-text search (always, as belt-and-braces)
 * Results are unioned and deduplicated by id.
 */
export async function retrieveCandidates(
  researcherSlug: string,
  limit = 150
): Promise<CandidateOpportunity[]> {
  const researcher = await getResearcherForMatching(researcherSlug);
  const seen = new Map<string, CandidateOpportunity>();

  // ── pgvector path ────────────────────────────────────────────────────────────
  if (researcher.profile_embedding) {
    const { data, error } = await supabase.rpc("match_opportunities", {
      query_embedding: researcher.profile_embedding,
      match_threshold: 0.2,
      match_count: 100,
    });
    if (error) console.warn("[retrieval] pgvector error:", error.message);
    if (data) {
      for (const row of data as CandidateOpportunity[]) {
        if (!seen.has(row.id)) seen.set(row.id, row);
      }
    }
  }

  // ── tsvector path ────────────────────────────────────────────────────────────
  const searchQuery = buildTsquery(
    researcher.research_themes,
    researcher.research_keywords
  );
  if (searchQuery) {
    const { data, error } = await supabase.rpc("search_opportunities_fts", {
      search_query: searchQuery,
      match_count: 100,
    });
    if (error) console.warn("[retrieval] tsvector error:", error.message);
    if (data) {
      for (const row of data as CandidateOpportunity[]) {
        if (!seen.has(row.id)) seen.set(row.id, row);
      }
    }
  }

  return [...seen.values()].slice(0, limit);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npm test -- --testPathPattern=opportunity-retrieval
```

Expected: `PASS — 6 tests pass`

- [ ] **Step 5: Commit**

```bash
git add src/lib/opportunity-retrieval.ts src/lib/__tests__/opportunity-retrieval.test.ts
git commit -m "feat: add hybrid pgvector + tsvector opportunity retrieval"
```

---

## Task 8: Update Match Route + Matcher Prompt

**Files:**
- Modify: `src/app/api/session/[name]/match/route.ts`
- Modify: `src/lib/prompts/matcher.ts`

- [ ] **Step 1: Update the matcher prompt**

In `src/lib/prompts/matcher.ts`, replace the entire `MATCHER_PROMPT` with:

```typescript
export const MATCHER_PROMPT = `
Score a researcher's profile against the provided funding opportunities. Produce a ranked, tiered list of matches with transparent reasoning. Opportunities are passed directly as JSON — do NOT search for files.

## Instructions

### Step 1: Read Inputs

1. Read the researcher's profile.json in full.
2. If a file named \`researcher-context.md\` exists alongside profile.json, read it for enriched context (citations, online presence, future research direction).
3. If a file named \`proposal-intent.json\` exists alongside profile.json, read it. Use it to sharpen Thematic Alignment and Strategic Fit scoring.
4. Read the list of funding opportunities from the \`<opportunities>\` JSON block in your input prompt. Do NOT read any files from funding-sources/.
5. Note the current date — this determines whether deadlines are still open.

### Step 2: Score Each Opportunity

For each opportunity in the JSON, apply the scoring framework below. Scores are 0-10 per dimension.

---

#### Dimension 1: Eligibility (Binary Gate)

If the researcher is ineligible, set overall score = 0 and move to the "Not Eligible" list with the reason. Do not score further.

Check:
- **Career stage:** Does the scheme's career stage requirement match the researcher's?
- **Institution:** Must be UK HEI? Is the researcher at a qualifying institution?
- **Nationality/residency:** Any restrictions that exclude this researcher?
- **Prior grant restrictions:** e.g. "must not have held a major grant" — check against \`prior_grants\` in profile.
- **Deadline:** If the deadline has passed and no next round is announced, mark as closed.

---

#### Dimension 2: Thematic Alignment (weight: 3x)

Score 0-10. This is the most important dimension.

- 9-10: Researcher's primary themes directly match the funder's stated priorities. The researcher's geographic/cultural focus is explicitly mentioned.
- 7-8: Strong overlap on 2+ themes. Funder's scope clearly includes this researcher's work.
- 5-6: Moderate overlap. The researcher could make a case for fit, but it's not obvious.
- 3-4: Tangential connection. Would require significant reframing.
- 1-2: Minimal overlap. Only very general alignment (e.g. "humanities").
- 0: No thematic alignment.

Cross-reference: \`research_themes\`, \`research_keywords\`, \`geographic_focus\`, \`disciplinary_fields\` from profile vs \`scope\`, \`description\` from the opportunity.

---

#### Dimension 3: Track Record Fit (weight: 2x)

Score 0-10.

- 9-10: Strong publication record in top-tier venues relevant to this funder's field. Prior successful grant from this funder or close peer.
- 7-8: Good publication record. Prior grants from peer funders.
- 5-6: Adequate record. Some relevant publications. Limited grant track record.
- 3-4: Thin publication record for this funder's expectations. No relevant prior grants.
- 1-2: Weak record relative to scheme requirements.
- 0: Insufficient track record for this scheme.

Consider: \`publications\` (recency, venue quality, relevance), \`prior_grants\` (funder, role, amount), \`phd_supervision\`.

---

#### Dimension 4: Strategic Fit (weight: 1x)

Score 0-10.

- 9-10: This grant perfectly fills a gap in the researcher's CV or directly supports an active project.
- 7-8: Clear strategic value — career progression, new collaborations, or supports current work.
- 5-6: Useful but not strategically critical.
- 3-4: Low strategic value.
- 1-2: Unlikely to advance the researcher's career goals.

Consider: \`key_strengths\`, \`potential_gaps\`, \`current_projects\` from profile.

---

#### Dimension 5: Practical Factors (weight: 1x)

Score 0-10.

- 9-10: Rolling or imminent deadline. Straightforward application. High amount relative to scope.
- 7-8: Deadline within 6 months. Moderate complexity.
- 5-6: Deadline in 6-12 months. Standard complexity.
- 3-4: Complex process. Low success rate relative to effort.
- 1-2: Highly competitive, onerous process.
- 0: Deadline unclear or scheme inactive.

Consider: \`deadline_date\`, \`deadline_raw\`, \`status\`, \`funding_type\`, \`amount_raw\`.

---

### Step 3: Calculate Overall Score

\`\`\`
overall_score = (thematic_alignment × 3 + track_record × 2 + strategic_fit × 1 + practical × 1) / 7
\`\`\`

Round to 1 decimal place. Eligibility-failed schemes score 0 overall.

---

### Step 4: Write Output

Write the matches.md file following this format exactly:

\`\`\`markdown
# Grant Matches for [Researcher Name]

> Generated: YYYY-MM-DD
> Profile version: [date of profile.json]
> Opportunities evaluated: [total count from JSON]

## Tier 1: Strong Matches (score 7.0+)

### 1. [Scheme Name] — [Funder]
- **Overall score:** X.X/10
- **Amount:** £X | **Deadline:** YYYY-MM-DD or rolling | **Status:** open
- **URL:** [url from opportunity]
- **Why this matches:**
  - [2-3 sentences explaining the alignment — be specific about which themes match]
- **Key strengths:** [what makes this researcher competitive]
- **Potential weaknesses:** [honest gaps to address]
- **Action:** [apply now / prepare for next round / monitor for next cycle]

## Tier 2: Worth Exploring (score 4.0–6.9)

[Same format as Tier 1]

## Tier 3: Long Shots or Future Opportunities (score 1.0–3.9)

[Same format — brief reasoning]

## Not Eligible

- **[Scheme] — [Funder]:** [One-line reason]

## Funding Gaps Identified

[1-2 paragraphs: gaps in the researcher's portfolio, types missing, funders to build relationships with]
\`\`\`

### Step 5: Constraints

- Make ZERO web calls.
- Never stretch a match. Be honest about weak fits.
- Flag schemes with deadlines within 30 days with ⚠️ URGENT.
`.trim();
```

- [ ] **Step 2: Update the match route**

Replace the entire content of `src/app/api/session/[name]/match/route.ts`:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "path";
import { mkdirSync } from "fs";
import { MATCHER_PROMPT } from "@/lib/prompts/matcher";
import { pipeQueryToSSE, sseResponse } from "@/lib/sse";
import { cleanupProposalIntent } from "@/lib/proposalIntent";
import { retrieveCandidates } from "@/lib/opportunity-retrieval";

export async function POST(
  _req: Request,
  { params }: { params: { name: string } }
): Promise<Response> {
  const { name } = params;
  const dataDir = resolve(process.cwd(), "data");
  const researcherDir = resolve(dataDir, `researchers/${name}`);

  // Ensure outputs directory exists
  mkdirSync(resolve(dataDir, `outputs/${name}`), { recursive: true });

  // Retrieve candidates from DB before starting the stream
  let candidatesJson = "[]";
  try {
    const candidates = await retrieveCandidates(name);
    candidatesJson = JSON.stringify(candidates, null, 2);
  } catch (err) {
    console.error(`[match] Failed to retrieve candidates for ${name}:`, err);
  }

  const stream = new ReadableStream<string>({
    async start(controller) {
      try {
        await pipeQueryToSSE(
          query({
            prompt: `Score and rank funding opportunities for researcher "${name}".

Researcher profile: ${researcherDir}/profile.json
Proposal intent (optional): ${researcherDir}/proposal-intent.json
Write output to: ${dataDir}/outputs/${name}/matches.md

Funding opportunities retrieved from database:
<opportunities>
${candidatesJson}
</opportunities>

Score each opportunity against the researcher's profile. Use the researcher-context.md file if it exists alongside profile.json.`,
            options: {
              cwd: dataDir,
              systemPrompt: MATCHER_PROMPT,
              // NO WebFetch, WebSearch, or Glob — candidates are in context
              allowedTools: ["Read", "Write"],
              permissionMode: "acceptEdits",
              maxTurns: 30,
            },
          }),
          controller
        );
      } finally {
        cleanupProposalIntent(researcherDir);
      }
    },
  });

  return sseResponse(stream);
}
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/session/[name]/match/route.ts src/lib/prompts/matcher.ts
git commit -m "feat: match against DB candidates via hybrid retrieval"
```

---

## Task 9: End-to-End Verification

- [ ] **Step 1: Run full test suite**

```bash
npm run test:all
```

Expected: All tests pass across both workspaces.

- [ ] **Step 2: Apply the DB migration**

Run `db/supabase/migrations/20260406000001_add_embeddings.sql` in your Supabase SQL editor if not already done in Task 1.

- [ ] **Step 3: Embed existing opportunities**

```bash
OPENAI_API_KEY=<your-key> npm run embed -w data-pipeline
```

Expected output: `Done: N embedded, 0 failed`

Verify in Supabase: `SELECT count(*) FROM opportunities WHERE embedding IS NOT NULL;`

- [ ] **Step 4: Check OPENAI_API_KEY is set for Next.js app**

Ensure `.env.local` contains:
```
OPENAI_API_KEY=sk-...
```

- [ ] **Step 5: End-to-end manual test**

```bash
npm run dev
```

1. Open the app and intake a researcher
2. Run **Profile** stage → enrichment generates profile.json with retrieval_summary
3. Check Supabase: `SELECT profile_embedding IS NOT NULL FROM researchers WHERE slug = '<name>';` → should be `true`
4. Run **Match** stage → verify the UI shows tiered matches from DB (not local files)
5. Confirm a niche/unusual opportunity appears via tsvector fallback

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: verify end-to-end matching pipeline"
```

---

## Environment Variables Required

| Variable | Used in | Purpose |
|----------|---------|---------|
| `OPENAI_API_KEY` | data-pipeline, Next.js app | Call text-embedding-3-small |
| `SUPABASE_URL` | both | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | both | Supabase service role access |

Add `OPENAI_API_KEY` to:
- `data-pipeline/.env` (for CLI commands)
- `.env.local` (for Next.js dev server)
