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
- **Prompt**: `src/lib/prompts/matcher.ts` (`MATCHER_SCORE_PROMPT`)
- **Tools**: `["Write"]` only — hard constraint: NO WebFetch/WebSearch
- **Retrieval**: `src/lib/opportunity-retrieval.ts` → 150 pre-filtered candidates (includes `funder_name` via funders JOIN)
- **Scoring**: 5 dimensions (eligibility, thematic, track record, strategic, practical)
- **Approach**: Write-tool based — agent writes one JSON score file per opportunity to `data/outputs/[name]/scores/`. Route reads and formats into `matches.md`.
- **Output**: `data/outputs/[name]/matches.md` with `<!-- opportunity-id:UUID -->` comments embedded per entry → parsed by `src/lib/parseMatches.ts` → `Match[]` (with `id?: string`)
- **UUID threading**: `opportunity_id` from score JSON → HTML comment in matches.md → `Match.id` → propose route direct lookup

## Agent 5 — Proposal Outliner

- **Route**: `POST /api/session/[name]/propose`
- **Prompt**: `src/lib/prompts/proposal-outliner.ts` (`PROPOSAL_OUTLINER_PROMPT`)
- **Input**: `{ funder, scheme, opportunityId? }` — when `opportunityId` is present, uses `getOpportunityById` (direct UUID lookup); falls back to `getOpportunityByFunderAndName`
- **Output**: 8-section alignment doc → `data/outputs/[name]/proposals/[funder]-[scheme-slug].md` + `researcher_proposals` table

## Session state

- `src/lib/sessionReducer.ts` — React reducer managing stage status (idle/running/done/error)
- `src/lib/pipelineStages.ts` — stage ordering + readiness gates
- `src/lib/sse.ts` — SDKMessage → SSEEvent conversion, `sseResponse()` helper

## Related

- [[Codebase Index]] · [[Database Schema]] · [[Retrieval Strategy]]
