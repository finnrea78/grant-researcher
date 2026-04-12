# Codebase Index

> Session-start orienteer. Read this first. ~2 min. Follow wikilinks for depth.

## Architecture at a glance

Next.js 14 monorepo → 3 workspaces: **src** (app + API), **data-pipeline** (CLI), **db** (schema + types).  
5 Claude agents stream via SSE. Supabase + pgvector for storage + semantic search.

## Core notes

- [[Pipeline Agents]] — the 5 Claude agents (profile → enrich → scan → match → propose)
- [[Grant Ingestion CLI]] — data-pipeline workspace, fetchers, normalisers, loaders
- [[Database Schema]] — Supabase tables, RLS, embeddings (pgvector)
- [[Retrieval Strategy]] — hybrid pgvector + tsvector, 150 candidate pre-filter

## Key paths (no exploration needed)

| What | Where |
|------|-------|
| Agent prompts | `src/lib/prompts/` (5 files) |
| Agent API routes | `src/app/api/session/[name]/` |
| Core types | `src/lib/types.ts` |
| SSE streaming | `src/lib/sse.ts` |
| Researcher CRUD | `src/lib/researcher-store.ts` |
| Opportunity CRUD | `src/lib/opportunity-store.ts` — `getOpportunityById`, `getOpportunityByFunderAndName`, upsert fns |
| Hybrid retrieval | `src/lib/opportunity-retrieval.ts` — returns `CandidateOpportunity` with `funder_name` |
| Scan persistence | `src/lib/scan-persistence.ts` |
| Embedder | `src/lib/embedder.ts` |
| UI components | `src/components/` |
| Pipeline CLI entry | `data-pipeline/src/cli.ts` |
| DB migrations | `db/supabase/migrations/` |

## Entry points

- `npm run dev` — start Next.js dev server (cwd must be monorepo root)
- `npm test` / `npm test -w data-pipeline` / `npm run test:all`
- `npm run ingest -w data-pipeline -- <source>` — run a fetcher

## Hard constraints (never violate)

- `match` route: NO `WebFetch` or `WebSearch` in allowedTools
- `params` is NOT a Promise in Next.js 14 — don't `await params`
- Assistant message content at `message.message.content` (nested BetaMessage)
- Supabase joined relations (`.select("..., funder:funders(...)")`) come back as arrays — always handle `Array.isArray(funderRaw) ? funderRaw[0] : funderRaw`

## Deeper context

- [[Architecture]] — product vision & design intent
- `.claude/CONTEXT.md` — current milestone
- `.claude/DECISIONS.md` — stack decisions + rationale

## Related domain notes

- [[UK Grant Landscape]] · [[Grant Databases — Full Catalogue]] · [[Pipeline Status]]
