# AI Pipeline Design

> Related: [[Architecture Review Index]] | [[Pipeline Agents]] | [[Cost Architecture]] | [[Refactor Plan — Steel Thread]] | [[Retrieval Strategy]]

How to think about the AI side. This is the actual product; everything else is plumbing.

## It's a pipeline, not "agents"

Be precise: most of the seven prompt stages are **single-shot structured LLM transforms**, not agents. Only `scan` and `enrich` are genuinely agentic (multi-turn, tool-using). Saying this clearly *simplifies the architecture* — most stages don't need the Agent SDK at all, just a typed `(input, ctx) → output` with a structured-output schema.

Model the pipeline as an **explicit typed DAG** (profile → enrich → scan → match → propose) with state persisted between stages, independent of HTTP and (thinly) independent of the model vendor. Today this is implicit inside route handlers; the `pipeline_state` column exists because the pipeline already wants to be resumable.

## Eval harness — build it early, not last

The hard problem in AI systems is not running them, it is knowing whether a change made them *better*. Fixed researcher fixtures, golden expected matches, a match-quality metric, regression on every prompt/retrieval change. Most vibe-coded AI apps never have this. It is the **single highest-leverage thing to build** and slots in as an early steel thread, on cached fixtures so it costs £0 ([[Cost Architecture]]).

## Structured outputs kill the brittle middle

`parseMatches` / `validateMatches` exist because the model returns free text. Tool-use / response schemas (with zod from the typed spine) remove an entire bug class and make the eval harness trivial to write. See [[Data Model & Typed DB Spine]].

## Taint is an architectural boundary, not a patch

CV-derived data is attacker-controlled. Design it into the pipeline type system:

- The agent that **ingests** untrusted input (`profile`) must never hold tools — it has `allowedTools: []` today; keep that as a *tested* invariant.
- The agent that **holds tools** (`enrich`, with WebFetch/WebSearch) must never see un-delimited tainted input.

This is a design principle and a publishable-flavoured angle (security of LLM pipelines). See [[Security Findings]] P1.

## Vendor seam — thin, not a framework

One interface at the stage boundary so models can be swapped/compared (Sonnet vs Haiku on match quality is a real evaluation result). Resist a heavy abstraction layer before it earns its keep.
