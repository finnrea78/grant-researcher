# Security Findings

> Related: [[Architecture Review Index]] | [[Cost Architecture]] | [[AI Pipeline Design]] | [[Database Schema]]

Prioritised from a read-only security pass over `src/middleware.ts`, `src/app/api/**`, `src/lib/prompts/*`, and the components. P0 = exploitable/costly now; P1 = important before any real use; P2 = hardening.

## P0 — fix before any real users

**P0-1 — Cross-tenant data leak (IDOR), genuine bug.** `src/lib/proposal-store.ts:57-68` (`getProposalsByResearcherSlug`) resolves slug → researcher with **no `user_id` filter**, using the service-role client which bypasses RLS. Callers `proposal/route.ts:16` and `status/route.ts:22` only check "is logged in". Any authenticated user reads anyone else's AI proposals by changing the slug in the URL (`/api/session/jane-smith/proposal`). Fix: thread `userId` through and `.eq("user_id", userId)`, mirroring `getResearcherFull`.

**P0-2 — Uncapped paid-LLM spend.** No per-user/per-IP rate limiting on any pipeline route. The only throttle is a process-global concurrency-2 semaphore (`src/lib/concurrency.ts:53`) — limits parallelism, not spend. One scripted account loops `/enrich` (Sonnet + WebSearch, billed via base SDK on Railway) + OpenAI embeddings with no ceiling. Fix: per-user rate limit + per-user daily run/cost cap before `agentQueue.acquire()`.

## P1 — important before real use

- Raw CV/profile text concatenated into prompts with no delimiter/guard (`profile/route.ts:27-28`, `enrich/route.ts:58-60`). Contained for `profile`/`match` (`allowedTools: []`) but **`enrich` runs with live WebFetch/WebSearch** — injection-to-web-fetch exfil path.
- The `CLAUDE.md` constraint "match must never include WebFetch/WebSearch" is true today (`match/route.ts:86` sets `allowedTools: []`) but **has no test guarding it**. One careless edit regresses it silently.
- No CV upload validation — no MIME/size/page cap (`intake/route.ts:69-75`, `pdfExtract.ts:8-30`). Crafted PDF = memory/CPU DoS that also feeds the paid LLM.
- Service-role client used for *all* user writes (`src/lib/supabase.ts:3`); RLS bypassed everywhere. Correctness depends on every query remembering `.eq("user_id", …)` — P0-1 is the proof that pattern fails silently. Prefer per-request RLS-scoped client for user data.

## P2 — hardening

- AI output rendering is **safe today** — React text nodes / `<pre>`, no `dangerouslySetInnerHTML`, no markdown renderer in deps. Latent risk: the day someone adds "render proposal as Markdown" on this attacker-influenceable content it becomes stored XSS. Note in code so it isn't reintroduced.
- Error strings leaked to client (`String(err)` in several routes). Map to generic messages; log details server-side.

## Calibration

For an internal demo: acceptable with a billing alert set. For real users: the P0s are ship-blockers — P0-1 is a data breach, not a hardening gap. Fix order: P0-1 → P0-2 → test the `allowedTools` constraint → delimit untrusted input + validate uploads → P2.
