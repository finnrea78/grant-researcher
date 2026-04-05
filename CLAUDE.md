# Grant Researcher

## Monorepo structure
- `src/` — Next.js 14 frontend (App Router), business logic in `src/lib/`
- `data-pipeline/` — CLI for ingesting grant data from GtR API and UKRI Funding Finder
- `db/` — Supabase client and type definitions

## Running the dev server
Always start from the project root: `npm run dev`
API routes use `resolve(process.cwd(), "core/data")` — cwd must be monorepo root

## Running tests
- `npm test` — run root app tests (Jest, covers `src/`)
- `npm test -w data-pipeline` — run data-pipeline tests
- `npm run test:all` — run all tests across workspaces

## Next.js 14 params syntax
In Next.js 14, `params` is a plain object — NOT a Promise. Use `{ params }: { params: { name: string } }` and access directly as `params.name`. The `use(params)` and `await params` patterns are Next.js 15 only.

## Next.js config
Use `next.config.mjs` (not `.ts`) — Next.js 14 does not support TypeScript config files
Use JSDoc types: `/** @type {import('next').NextConfig} */`

## Claude Agent SDK — SDKMessage shape
Assistant message content lives at `message.message.content` (nested BetaMessage), not `message.content`
See `src/lib/sse.ts` for the canonical streaming pattern

## core package exports
Prompts live in `src/lib/prompts/`. No build step needed — imported directly.

## Hard constraints (match command)
`match` route must never include `WebFetch` or `WebSearch` in `allowedTools` — enforced in TypeScript
