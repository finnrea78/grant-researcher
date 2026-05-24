# Codebase Assessment

> Related: [[Architecture Review Index]] | [[Refactor Plan — Steel Thread]] | [[Pipeline Status]]

Verdict: vibe-coded, but not the bad kind. The bad kind has no structure, no tests, no docs, and invariants living only in the author's head. This isn't that.

## Good bones (why refactor, not rewrite)

- npm-workspace monorepo, clean separation: `src/` (app), `db/` (migrations + client), `data-pipeline/` (ingestion CLI).
- **All DB access funnelled through ~7 `*-store.ts` modules.** Small, known blast radius for any schema change. This is the single best structural decision in the repo and the main reason refactor beats rewrite.
- Ordered, version-controlled raw-SQL migrations with RLS + triggers + pgvector RPCs. Schema *evolution* is disciplined.
- Store-level unit tests exist (`src/lib/__tests__/`).
- Documented hard constraints in `CLAUDE.md` (e.g. "match route must never include WebFetch/WebSearch").

## Known, localised debt

- No typed DB spine; hand-written types already drifting. → [[Data Model & Typed DB Spine]]
- Expensive agentic ingestion coupled into the user request path. → [[Cost Architecture]]
- No evaluation harness for pipeline quality. → [[AI Pipeline Design]]
- Concrete P0 security issues. → [[Security Findings]]
- Observability gap. → [[Deployment & Observability]]

## Decision: strangler refactor in place

A full v2 rewrite is the canonical solo-founder mistake — the second-system effect, months without shipping, and faithful reintroduction of the same bugs. The debt here is *localised and known* behind a narrow interface (the stores), which is precisely the condition where in-place refactor strictly dominates rewrite.

Two pieces will *feel* like rebuilds but stay in-place (new migrations, strangler, not a new repo): the **data model redesign** and **decoupling the pipeline from HTTP**. "v2" should mean "the refactored v1," not `git init`.

Calibration: as a pre-revenue solo product, "correct" means the *core* (data model, module boundaries, cost, observability) is right and cheap to run — not that the infra is impressive.
