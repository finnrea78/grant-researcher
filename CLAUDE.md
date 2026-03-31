# Grant Scout V2

## Monorepo structure
- `core/` — TypeScript CLI using `@anthropic-ai/claude-agent-sdk`
- `grant-researcher/` — Next.js 14 frontend (App Router)

## Running the dev server
Always start from `grant-scout-v2/` (monorepo root): `npm run dev -w grant-researcher`
API routes use `resolve(process.cwd(), "core/data")` — cwd must be monorepo root

## Next.js 14 params syntax
In Next.js 14, `params` is a plain object — NOT a Promise. Use `{ params }: { params: { name: string } }` and access directly as `params.name`. The `use(params)` and `await params` patterns are Next.js 15 only.

## Next.js config
Use `next.config.mjs` (not `.ts`) — Next.js 14 does not support TypeScript config files
Use JSDoc types: `/** @type {import('next').NextConfig} */`

## Claude Agent SDK — SDKMessage shape
Assistant message content lives at `message.message.content` (nested BetaMessage), not `message.content`
See `core/src/stream.ts` for the canonical streaming pattern

## core package exports
Prompts are importable as `grant-scout/prompts/profile-builder` etc. (requires built dist/)
Rebuild after prompt changes: `cd core && npm run build`

## Hard constraints (match command)
`match` route must never include `WebFetch` or `WebSearch` in `allowedTools` — enforced in TypeScript
