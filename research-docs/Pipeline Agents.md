# Pipeline Agents

5 Claude agents, each an SSE-streaming API route at `src/app/api/session/[name]/`.  
All use `@anthropic-ai/claude-agent-sdk`. Data persisted to Supabase and local `data/`.

## Agent 1 — Profile Builder

- **Route**: `POST /api/session/[name]/profile`
- **Prompt**: `src/lib/prompts/profile-builder.ts` (`PROFILE_BUILDER_PROMPT`)
- **Input**: raw CV text (PDF/DOCX extracted by `src/lib/extractCvText.ts`)
- **Output**: `ResearcherProfile` JSON → saved to `data/researchers/[name]/profile.json` + Supabase
- **Store fn**: `updateResearcherProfile` in `src/lib/researcher-store.ts`

## Agent 2 — Researcher Enricher

- **Route**: `POST /api/session/[name]/enrich`
- **Prompt**: `src/lib/prompts/researcher-enricher.ts` (`RESEARCHER_ENRICHER_PROMPT`)
- **Tools**: WebFetch/WebSearch (Google Scholar, ORCID, institutional pages)
- **Input**: profile.json + ORCID candidate from `data/researchers/[name]/enrich-pending.json`
- **Output**: enriched profile + embedding stored in Supabase (`profile_embedding` pgvector)
- **Completion marker**: `data/researchers/[name]/researcher-context.md`

## Agent 3 — Grant Scanner

- **Route**: `POST /api/session/[name]/scan`
- **Prompt**: `src/lib/prompts/grant-scanner.ts` (`GRANT_SCANNER_PROMPT`)
- **Tools**: WebFetch (reads `_urls.md` seed list, harvests funder pages)
- **Output**: writes `data/funding-sources/[funder].md` + `_discovered.json`
- **Persistence**: `src/lib/scan-persistence.ts` → `upsertFunderFromDiscovery` → Supabase

## Agent 4 — Matcher

- **Route**: `POST /api/session/[name]/match`
- **Prompt**: `src/lib/prompts/matcher.ts` (`MATCHER_PROMPT`)
- **Tools**: NONE (no WebFetch/WebSearch — hard constraint)
- **Retrieval**: `src/lib/opportunity-retrieval.ts` → 150 pre-filtered candidates
- **Scoring**: 5 dimensions (eligibility, thematic, track record, strategic, practical)
- **Output**: `data/outputs/[name]/matches.md` → parsed by `src/lib/parseMatches.ts` → `Match[]`

## Agent 5 — Proposal Outliner

- **Route**: `POST /api/session/[name]/propose`
- **Prompt**: `src/lib/prompts/proposal-outliner.ts` (`PROPOSAL_OUTLINER_PROMPT`)
- **Input**: chosen scheme slug + researcher profile + intent from `src/lib/proposalIntent.ts`
- **Output**: 8-section alignment doc → `data/outputs/[name]/[scheme-slug].md` + `researcher_proposals` table

## Session state

- `src/lib/sessionReducer.ts` — React reducer managing stage status (idle/running/done/error)
- `src/lib/pipelineStages.ts` — stage ordering + readiness gates
- `src/lib/sse.ts` — SDKMessage → SSEEvent conversion, `sseResponse()` helper

## Related

- [[Codebase Index]] · [[Database Schema]] · [[Retrieval Strategy]]
