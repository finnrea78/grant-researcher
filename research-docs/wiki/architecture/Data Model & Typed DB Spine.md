# Data Model & Typed DB Spine

> Related: [[Architecture Review Index]] | [[Database Schema]] | [[Cost Architecture]] | [[Refactor Plan — Steel Thread]]

The database is not properly planned, and the type layer is the weakest of the available options.

## No ORM, no generated types — and it's already drifting

- No ORM. No Drizzle, no Prisma. `db/package.json` runtime dep is only `@supabase/supabase-js`. The README header "Database (Supabase / Drizzle)" is **vestigial** — Drizzle belonged to the deprecated v1 (`grant-scout`).
- `db/src/types.ts` row interfaces are **hand-written**. No `Database` generic on `createClient` (`db/src/client.ts:14`), so the supabase-js query builder runs fully untyped (`any`). Zero compile-time coupling between types and schema.
- **Drift is real, not hypothetical.** `ResearcherRow` (`db/src/types.ts:60-82`) omits ~5 columns the schema has and stores use (`pipeline_state`, `scholar_candidate`, `publications_md`, `match_results_md`, `profile_embedding`). The store works around this with `Record<string, unknown>` and casts (`researcher-store.ts:20,287-291`). The types are decorative.
- ~37 `.from()` + 2 `.rpc()` sites in `src/`, plus ~8 in `data-pipeline/`. Table names, `onConflict` keys, `.select()` projections are all unchecked strings.

## Cheapest high-leverage fix (no ORM needed)

Add a `db:generate` script: `supabase gen types typescript --linked > db/src/database.types.ts`. Type the client `createClient<Database>(...)`. Replace hand-written interfaces with `Tables<'researchers'>`. Converts ~45 runtime-only call sites to compile-time-checked. Adopt Drizzle later *only* if query complexity outgrows single-table CRUD + RPCs — treat that as a deliberate TS learning goal, not a default.

## Three deliberate data partitions

Design the schema as three partitions the current one only gestures at:

1. **Reference data** — funders, opportunities, awarded grants. Slowly-changing, shared, ingested. Design for **idempotent upsert + dedup + provenance**: stable natural key, `source`, `fetched_at`, content hash for change detection. **Dedup across ~58 funder sources is the actual hard problem** (same call appears on UKRI + funder page + aggregator), not the table shape.
2. **User data** — researchers, profiles, matches, proposals. RLS-scoped, user-owned. Where P0-1 lives ([[Security Findings]]) — ownership is a schema decision, not a patch.
3. **Operational data** — one `pipeline_runs` / `agent_runs` table: stage, model, tokens in/out, cost, latency, status. Highest-leverage single addition: answers cost, answers "what is it doing", and is the eval substrate. See [[Deployment & Observability]] and [[AI Pipeline Design]].

Embeddings lifecycle: compute once, backfill, **version the embedding model** so a model change is a tracked migration not silent drift.
