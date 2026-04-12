# Pipeline Agents

5 Claude agents, each an SSE-streaming API route at `src/app/api/session/[name]/`.  
All use `@anthropic-ai/claude-agent-sdk`. All persistent state lives in Supabase — no filesystem writes for pipeline state.

## Agent 1 — Profile Builder

- **Route**: `POST /api/session/[name]/profile`
- **Prompt**: `src/lib/prompts/profile-builder.ts` (`PROFILE_BUILDER_PROMPT`)
- **Input**: `cv_text` + `intake` + `proposal_intent` read from DB via `getResearcherFull`
- **Output**: `ResearcherProfile` JSON → `enriched_profile` column + `publications_md` column + `pipeline_state.profile = true` via `updateResearcherProfile`, `updatePublicationsMd`, `updatePipelineState`
- **Model**: Haiku (single-turn, structured JSON response — no tools)

## Agent 2 — Researcher Enricher

- **Route**: `POST /api/session/[name]/enrich`
- **Prompt**: `src/lib/prompts/researcher-enricher.ts` (`RESEARCHER_ENRICHER_PROMPT`)
- **Tools**: WebFetch/WebSearch (Google Scholar, ORCID, institutional pages)
- **Input**: `enriched_profile` + ORCID candidate from `pipeline_state.scholar_candidate` (both from DB)
- **Output**: updated `enriched_profile` + `profile_embedding` pgvector column + `pipeline_state.enrich = true`

## Agent 3 — Grant Scanner

- **Route**: `POST /api/session/[name]/scan`
- **Prompt**: `src/lib/prompts/scan-planner.ts` (`SCAN_PLANNER_PROMPT`)
- **Tools**: WebFetch + Tavily MCP (if `TAVILY_API_KEY` set); reads `data/funding-sources/_urls.md` seed list
- **Working files**: `data/funding-sources/_scan-plan.json`, `_discovered.json` (intermediate only, not persistent state)
- **Output**: `persistDiscoveredManifest` → `funding_sources` table in Supabase; `pipeline_state.scan = true`
- **Skip**: `PATCH` sets `pipeline_state.scan = true` without running the agent

## Agent 4 — Matcher

- **Route**: `POST /api/session/[name]/match`
- **Prompt**: `src/lib/prompts/matcher.ts` (`MATCHER_PROMPT`)
- **Tools**: `["Write"]` only — hard constraint: NO WebFetch/WebSearch
- **Retrieval**: `src/lib/opportunity-retrieval.ts` → 150 pre-filtered candidates (hybrid pgvector + tsvector, includes `funder_name` via funders JOIN)
- **Scoring**: 5 dimensions (eligibility, thematic, track record, strategic, practical)
- **Approach**: Agent emits JSON score objects in its text output; route uses incremental parser to emit each score as a `match` SSE event in real time
- **Output**: `upsertMatchBatch` → `researcher_matches` table; formatted markdown → `match_results_md` column; `pipeline_state.match = true`

## Agent 5 — Proposal Outliner

- **Route**: `POST /api/session/[name]/propose`
- **Prompt**: `src/lib/prompts/proposal-outliner.ts` (`PROPOSAL_OUTLINER_PROMPT`)
- **Input**: `{ funder, scheme, opportunityId? }` — when `opportunityId` present, uses `getOpportunityById`; falls back to `getOpportunityByFunderAndName`. Researcher profile injected from DB (no file reads).
- **Output**: proposal text captured from agent text output (no Write tool); `upsertProposalBySlug` → `researcher_proposals` table

## Session state

- `src/lib/sessionReducer.ts` — React reducer managing stage status (idle/running/done/error)
- `src/lib/pipelineStages.ts` — stage ordering + readiness gates
- `src/lib/sse.ts` — SDKMessage → SSEEvent conversion, `sseResponse()` helper

## Related

- [[Codebase Index]] · [[Database Schema]] · [[Retrieval Strategy]]
