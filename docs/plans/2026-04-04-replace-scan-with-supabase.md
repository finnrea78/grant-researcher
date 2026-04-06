# Plan: Replace Scan Step with Supabase Grant Queries

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the expensive scan step (Claude agent scraping ~30 URLs) and query Supabase directly for grant data. Pipeline goes from 5 stages to 4: Profile → Enrich → Match → Propose.

**Architecture:** The match route fetches open schemes from Supabase, formats them as structured text, and injects them into the matcher prompt. The Claude matcher agent receives grants inline instead of reading markdown files from disk.

**Tech Stack:** Supabase (PostgREST), @supabase/supabase-js, Next.js 14 API routes

---

## Background

The app currently has a 5-stage pipeline: Profile → Enrich → **Scan** → Match → Propose.

The scan step invokes a Claude agent with WebFetch/WebSearch to scrape ~30 funder URLs and write markdown files to `data/funding-sources/`. This is:
- Expensive (Claude API calls + web fetches per session)
- Slow (minutes per scan)
- Redundant (grant data doesn't change per user)

The `data-pipeline/` workspace already ingests grants from GtR REST API and UKRI Funding Finder into Supabase. As of writing, ~12k+ GtR projects and 32 live UKRI opportunities are in the DB.

**Note:** The codebase has been refactored since the original plan was written. The Supabase client has been extracted to a shared `@grant-researcher/db` package. The `data-pipeline` imports from `@grant-researcher/db` instead of its own `db.ts`. Check the current state of `packages/db/` and root `package.json` workspaces before starting.

### Key data points

- Only `open`, `rolling`, `upcoming` schemes are relevant for matching (not `active_award`/`closed_award` from GtR historical data)
- ~32 live UKRI opportunities at ~150 tokens each = ~4-5k tokens — fits easily inline in the prompt
- RLS is already configured for public read on `funders`, `schemes`, `scheme_classifications` (anon key works)
- The matcher prompt's scoring dimensions and output format stay unchanged

### Current pipeline data flow

```
[Scan] → Claude agent scrapes 30 URLs → writes data/funding-sources/*.md
[Match] → Claude agent reads profile.json + all funding-sources/*.md → scores → writes matches.md
```

### New data flow

```
[Match] → API route queries Supabase → formats schemes as text → injects into matcher prompt
          Claude agent reads profile.json + inline schemes → scores → writes matches.md
```

---

## Critical Files Reference

### Files to CREATE

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client using anon key (server-side only) |
| `src/lib/fetchOpenSchemes.ts` | Query open schemes with funder + classification joins |
| `src/lib/formatSchemesForPrompt.ts` | Format SchemeWithFunder[] into text for matcher prompt |

### Files to MODIFY

| File | Lines | What changes |
|------|-------|-------------|
| `src/app/api/session/[name]/match/route.ts` | 1-43 | Fetch from Supabase, inject into prompt, remove Glob tool |
| `src/lib/prompts/matcher.ts` | 1-157 | Update Steps 1, 2, 6 for inline data instead of file reading |
| `src/components/PipelineBar.tsx` | 1-89 | Remove scan from StageState, STAGE_LABELS, STAGE_ORDER |
| `src/app/session/[name]/page.tsx` | 1-301 | Remove scan from state machine, INIT action, handleRun |
| `src/app/api/session/[name]/status/route.ts` | 1-43 | Remove scanMarkerPath check and scan from response |
| `.env.example` | — | Add SUPABASE_URL, SUPABASE_ANON_KEY |
| `package.json` (root) | — | Add @supabase/supabase-js dependency |

### Files NOT modified (preserved for future use)

| File | Why kept |
|------|----------|
| `src/app/api/session/[name]/scan/route.ts` | May want web-search-based discovery later |
| `src/lib/prompts/grant-scanner.ts` | Scanner prompt, unused but preserved |

---

## Tasks

### Task 1: Install Supabase in root workspace

**Files:**
- Modify: `package.json` (root)

- [ ] Add `@supabase/supabase-js` to root dependencies (check if `@grant-researcher/db` already provides this — if the shared db package is in the workspace and exports a client, the Next.js app may be able to import from it directly instead)
- [ ] Run `npm install`

---

### Task 2: Create Supabase client for Next.js

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] Create server-side Supabase client using `SUPABASE_URL` and `SUPABASE_ANON_KEY` from `process.env`
- [ ] Throw clear error if either env var is missing
- [ ] Export the client instance

**Note:** Check if `@grant-researcher/db` already exports a client that could be reused. If it uses the service role key, create a separate client here with the anon key. The anon key is appropriate for the Next.js app since RLS policies allow public reads.

```ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
}

export const supabase = createClient(url, key);
```

---

### Task 3: Create scheme-fetching function

**Files:**
- Create: `src/lib/fetchOpenSchemes.ts`

- [ ] Define `SchemeWithFunder` type:

```ts
export interface SchemeWithFunder {
  id: string;
  name: string;
  funder_name: string;
  funder_disciplines: string[];
  status: string | null;
  deadline_date: string | null;
  deadline_raw: string | null;
  amount_raw: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_currency: string;
  duration: string | null;
  career_stage: string | null;
  institutional_eligibility: string | null;
  thematic_priorities: string | null;
  application_process: string | null;
  url: string | null;
  source: string;
  classifications: { type: string; name: string; percentage: number | null }[];
}
```

- [ ] Query Supabase:

```ts
const { data, error } = await supabase
  .from("schemes")
  .select(`
    *,
    funder:funders!inner(name, disciplines),
    classifications:scheme_classifications(type, name, percentage)
  `)
  .not("status", "in", '("active_award","closed_award")')
  .order("deadline_date", { ascending: true });
```

- [ ] Map the Supabase response into `SchemeWithFunder[]` (flatten the funder join)
- [ ] Export as `async function fetchOpenSchemes(): Promise<SchemeWithFunder[]>`

---

### Task 4: Create prompt formatter

**Files:**
- Create: `src/lib/formatSchemesForPrompt.ts`

- [ ] Import `SchemeWithFunder` type
- [ ] Format each scheme as a text block:

```
=== SCHEME: [Name] ===
Funder: [funder_name]
Status: [status]
Deadline: [deadline_date or deadline_raw or "Not specified"]
Amount: [amount_raw or formatted min-max or "Not specified"]
Duration: [duration or "Not specified"]
Career stage: [career_stage or "Not specified"]
Eligibility: [institutional_eligibility or "Not specified"]
Thematic priorities: [thematic_priorities or "Not specified"]
Application process: [application_process or "Not specified"]
URL: [url or "Not specified"]
Classifications: [comma-separated list of classification names]
Source: [source]
```

- [ ] Export as `function formatSchemesForPrompt(schemes: SchemeWithFunder[]): string`
- [ ] Return empty-state message if no schemes: "No open funding opportunities found in the database."

---

### Task 5: Update matcher prompt

**Files:**
- Modify: `src/lib/prompts/matcher.ts`

- [ ] **Step 1 (lines 8-9):** Remove check for harvested funding files. Replace with:
  ```
  1. Check that the researcher's profile.json exists. If not, stop and report: "Profile not found. Run the profile stage first."
  2. The funding opportunities are provided inline in this prompt. If none are listed below, report: "No open funding opportunities found in the database."
  ```

- [ ] **Step 2 (lines 15-17):** Remove file-reading instructions. Replace with:
  ```
  3. The funding opportunities are provided inline in the task prompt below. Parse each scheme block to extract all scoring fields.
  4. Build a list of all schemes from the inline data.
  ```

- [ ] **Line 118:** Change `Sources scanned: [count of funder files read]` to `Schemes from database: [total count]`

- [ ] **Step 6 (line 155):** Remove "If a funder file only contains 'Harvest pending'" line

- [ ] Keep ALL scoring dimensions (lines 19-106) and output format (lines 108-150) **unchanged**

---

### Task 6: Update match API route

**Files:**
- Modify: `src/app/api/session/[name]/match/route.ts`

This is the core integration point.

- [ ] Import `fetchOpenSchemes` and `formatSchemesForPrompt`
- [ ] Before creating the SSE stream, fetch and format schemes:

```ts
let formattedSchemes: string;
try {
  const schemes = await fetchOpenSchemes();
  formattedSchemes = formatSchemesForPrompt(schemes);
} catch (err) {
  return Response.json(
    { error: `Failed to fetch grant data: ${err instanceof Error ? err.message : String(err)}` },
    { status: 500 }
  );
}
```

- [ ] Update the prompt string passed to `query()`:

```ts
prompt: `Score and rank all funding opportunities for researcher "${name}".

Researcher profile: ${dataDir}/researchers/${name}/profile.json
Write output to: ${dataDir}/outputs/${name}/matches.md

Remember: make ZERO web calls. All matching is based solely on the provided data.

## Funding Opportunities (${schemes.length} open schemes from database)

${formattedSchemes}`,
```

- [ ] Update `allowedTools` — remove `Glob`, keep `Read` and `Write`:

```ts
allowedTools: ["Read", "Write"],
```

- [ ] Commit

**Note:** The route uses `params: Promise<{ name: string }>` with `await params` (Next.js 15 style). Keep this pattern as-is since it works.

---

### Task 7: Update status route (remove scan)

**Files:**
- Modify: `src/app/api/session/[name]/status/route.ts`

- [ ] Remove line 16: `const scanMarkerPath = resolve(dataDir, \`researchers/${name}/_scan-complete\`);`
- [ ] Remove `scan: existsSync(scanMarkerPath)` from the response object (line 38)
- [ ] Response becomes: `{ profile, enrich, match, proposals, scholarCandidate }`
- [ ] Commit

---

### Task 8: Update PipelineBar (5 stages to 4)

**Files:**
- Modify: `src/components/PipelineBar.tsx`

- [ ] Remove `scan: StageStatus;` from `StageState` interface (line 6)
- [ ] Remove `scan: "Scan",` from `STAGE_LABELS` (line 19)
- [ ] Remove `"scan"` from `STAGE_ORDER` (line 24)
- [ ] New order: `["profile", "enrich", "match", "propose"]`
- [ ] Everything else (isReady, rendering) works automatically from the array
- [ ] Commit

---

### Task 9: Update session page state machine

**Files:**
- Modify: `src/app/session/[name]/page.tsx`

- [ ] Remove `scan: boolean;` from the INIT action type (line 25)
- [ ] Remove `scan: action.scan ? "complete" : "idle",` from reducer INIT case (line 43)
- [ ] Remove `scan: "idle"` from `INITIAL_STATE.stages` (line 77)
- [ ] Remove `scan: \`/api/session/${name}/scan\`,` from handleRun urls (line 184)
- [ ] Commit

---

### Task 10: Update .env.example and verify

**Files:**
- Modify: `.env.example`

- [ ] Add Supabase env vars:

```
# Supabase — grant database (read-only from frontend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] Add the real values to `.env.local` for testing
- [ ] Run `npm run dev` — verify no build errors
- [ ] Navigate to a session page — confirm 4 pipeline stages visible
- [ ] Run Profile → Enrich → Match and verify results
- [ ] Commit

---

## Verification

1. `npm run dev` — no build errors
2. Session page shows 4 stages: Profile, Enrich, Match, Propose (no Scan)
3. Match unlocks after Enrich completes (not after Scan)
4. Running Match fetches schemes from Supabase and produces tiered matches
5. `matches.md` contains real scheme names from the database
6. The scan API route still exists at `/api/session/{name}/scan` but nothing calls it
7. No regression in Profile, Enrich, or Propose stages
