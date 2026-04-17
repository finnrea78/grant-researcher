# Grant Researcher

## Project structure
Root is a Next.js 14 app with two npm workspaces:
- `src/` — Next.js App Router (pages, API routes, components, lib)
- `data-pipeline/` — CLI for ingesting grants from UKRI into Supabase
- `db/` — Supabase schema, client, types (`@grant-researcher/db`)
- `data/` — local filesystem storage (researchers, funding-sources, outputs)

## Key paths
- `src/lib/prompts/` — 5 agent prompt templates (profile-builder, researcher-enricher, grant-scanner, matcher, proposal-outliner)
- `src/app/api/session/[name]/` — agent API routes (profile, enrich, scan, match, propose, status, matches)
- `src/lib/types.ts` — core interfaces (ResearcherProfile, IntakeData, etc.)
- `src/lib/sse.ts` — SDKMessage → SSEEvent streaming helper
- `src/lib/researcher-store.ts` — Supabase CRUD for researcher profiles
- `src/components/` — React UI (IntakeWizard, PipelineBar, StageLog, MatchList, ProposalViewer)

## Running
`npm run dev` from project root. API routes use `resolve(process.cwd(), "data")` — cwd must be monorepo root.

## Testing convention
When the user says "test it" or "let's test this", start the dev server with `npm run dev` (background) and give them the local URL — unless they explicitly say "run unit tests" or similar.

## Running tests
- `npm test` — run root app tests (Jest, covers `src/`)
- `npm test -w data-pipeline` — run data-pipeline tests
- `npm run test:all` — run all tests across workspaces

## Stack
Next.js 14, @anthropic-ai/claude-agent-sdk, Supabase, Tailwind/shadcn, TypeScript. Deployed on Railway.

## Next.js 14 constraints
- `params` is a plain object, NOT a Promise. Use `{ params }: { params: { name: string } }`. The `use(params)` and `await params` patterns are Next.js 15 only.
- Config must be `next.config.mjs` (not `.ts`). Use JSDoc types: `/** @type {import('next').NextConfig} */`

## Claude Agent SDK
Assistant message content lives at `message.message.content` (nested BetaMessage), not `message.content`. See `src/lib/sse.ts` for the streaming pattern.

**Prefer `@anthropic-ai/claude-agent-sdk` over `@anthropic/sdk`** — locally, the agent SDK routes through the Claude subscription (no API token usage). Only reach for the base `@anthropic/sdk` if the agent SDK cannot support the use case.

## Hard constraints
- `match` route must never include `WebFetch` or `WebSearch` in `allowedTools`

## Session start
Read `research-docs/wiki/codebase/Codebase Index.md` at the start of any session where you need codebase orientation. It's a 2-minute wikilink graph covering all modules, key paths, and hard constraints — avoids full codebase re-exploration.

## Deeper context
- `research-docs/wiki/codebase/Codebase Index.md` — module map + wikilinks to detail notes
- `research-docs/wiki/codebase/Pipeline Agents.md` — the 5 Claude agents
- `research-docs/wiki/codebase/Database Schema.md` — Supabase tables + RLS + embeddings
- `research-docs/wiki/codebase/Retrieval Strategy.md` — hybrid pgvector + tsvector
- `research-docs/wiki/codebase/Grant Ingestion CLI.md` — data-pipeline CLI commands
- `.claude/CONTEXT.md` — product vision, target user, current milestone
- `.claude/DECISIONS.md` — why we chose this stack and architecture

@.claude/skills/SKILLS.md
