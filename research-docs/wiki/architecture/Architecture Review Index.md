# Architecture Review Index

> Related: [[Codebase Assessment]] | [[Security Findings]] | [[Data Model & Typed DB Spine]] | [[Cost Architecture]] | [[Deployment & Observability]] | [[AI Pipeline Design]] | [[Refactor Plan — Steel Thread]]

Captured from the May 2026 architecture review of the grant-researcher startup codebase (the product, not the MSc — MSc lives in `grant-researcher-msc/`). Evidence-based: two read-only sweeps over `src/`, `db/`, `data-pipeline/`.

## TL;DR

The codebase is vibe-coded but has **good bones**. The headline decision: **refactor in place, do not rewrite a v2**. The debt is localised behind a narrow store interface, which is the exact precondition where a strangler refactor beats a rewrite. A from-scratch v2 is the second-system trap — months of not shipping while reintroducing the same bugs.

Five things make it "built correctly" without over-engineering:

1. **Typed DB spine** — there is no ORM and no generated types; the hand-written row types are *already drifting* from the schema. Cheapest high-leverage fix in the repo. → [[Data Model & Typed DB Spine]]
2. **Decouple expensive shared-data production from cheap per-user consumption** — the core cost decision. Agentic grant discovery must be offline/batched, not in the request path. → [[Cost Architecture]]
3. **Fix the P0s before any real users** — a concrete cross-tenant data leak (IDOR) and uncapped LLM spend. → [[Security Findings]]
4. **Observability in-app, not a new platform** — Railway is fine; "I can't see what it's doing" is an instrumentation gap. → [[Deployment & Observability]]
5. **It's a pipeline, not "agents"** — model it as a typed DAG with an eval harness; only `scan`/`enrich` are genuinely agentic. → [[AI Pipeline Design]]

## What is explicitly NOT recommended

- No v2 rewrite. Strangler refactor of the existing repo.
- No microservices. Modular monolith, one repo, one justified process seam (a worker).
- No EKS/Kubernetes. No AWS migration on the critical path. Railway stays; keep the app deployment-portable via a clean Dockerfile + 12-factor config.

## Sequenced delivery

The refactor is sequenced as shippable steel threads — see [[Refactor Plan — Steel Thread]]. Workflow: `superpowers:brainstorming` → `superpowers:writing-plans` before touching code (project mandate, see [[Codebase Index]]).
