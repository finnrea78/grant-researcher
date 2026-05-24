# Refactor Plan — Steel Thread

> Related: [[Architecture Review Index]] | [[Codebase Assessment]] | [[Data Model & Typed DB Spine]] | [[Cost Architecture]] | [[AI Pipeline Design]] | [[Security Findings]]

Steel thread = build the thinnest slice that touches every layer end-to-end and actually runs, then thicken one segment at a time, always shippable. Not a rewrite — a strangler refactor of the existing repo ([[Codebase Assessment]]).

## Target structure (what good looks like)

Modular monolith, domain-centric, dependency arrows pointing inward:

```
core/        pure domain: the typed pipeline DAG, scoring, types — no I/O
adapters/    db / llm / storage / http — implement core "ports"
app/         Next.js routes = thin transport over core
worker/      queue consumer: scheduled ingestion + long pipeline stages
eval/        harness + fixtures + golden matches
db/          migrations + GENERATED types
```

Rule: `app`/`worker` → `core` → nothing; adapters implement interfaces `core` declares. One repo, one justified process seam (`worker`). No microservices.

## Thread sequence (each ships)

0. **Walking skeleton** — one CV → real `profile` call → typed persist → stubbed match → render, deployed. One hardcoded user. Proves every integration point.
1. **Typed DB spine** — generated Supabase types + `Database` generic + RLS-scoped per-request client as default. Retires drift and P1-4/P0-1 by construction. → [[Data Model & Typed DB Spine]]
2. **Zod at every boundary** — upload, intake, LLM-output parsing. Kills prompt-injection surface + brittle `parseMatches`. The big TypeScript-learning lever (zod ≈ pydantic; `z.infer`).
3. **Real retrieval + scoring** — port v1's pgvector/tsvector RPCs (already clean). → [[Retrieval Strategy]]
4. **Real auth + per-user run/cost cap before the agent queue** — P0-2 gone by construction. → [[Security Findings]]
5. **`enrich`/`propose` with delimited untrusted input** + a test asserting `match` has `allowedTools: []`.
6. **SSE/UI polish** with discriminated-union event types (idiomatic TS union narrowing).

Running alongside, not a numbered step: the **offline batched ingestion worker** — the cost firewall. → [[Cost Architecture]]

## Process

Project mandate (see [[Codebase Index]]): `superpowers:brainstorming` → `superpowers:writing-plans` before touching code. Frame the brainstorm as *"refactor v1 in place: typed DB spine + offline batched ingestion + cost controls + observability,"* sequenced as the threads above, returning a reviewed plan and a costed first thread.
