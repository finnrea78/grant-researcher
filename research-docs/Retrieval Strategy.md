# Retrieval Strategy

Hybrid retrieval in `src/lib/opportunity-retrieval.ts`.  
Runs before the Match agent to pre-filter 150 candidates from all opportunities.

## Why hybrid

- **pgvector alone**: misses keyword-specific grants (e.g. "bioinformatics fellowships")
- **tsvector alone**: misses semantically-related but differently-worded grants
- **Hybrid**: semantic coverage + keyword precision, de-duplicated

## Flow

```
retrieveCandidates(researcherSlug)
  │
  ├── getResearcherForMatching (researcher-store)
  │     → researcher profile + embedding from Supabase
  │
  ├── pgvector cosine similarity query
  │     SELECT ... ORDER BY embedding <=> $profile_embedding LIMIT 100
  │
  ├── tsvector full-text search (always runs as fallback)
  │     SELECT ... WHERE to_tsvector(...) @@ buildTsquery(keywords) LIMIT 80
  │
  ├── de-duplicate by opportunity slug
  │
  └── return top 150 candidates → passed to MATCHER_PROMPT
```

## Why 150

Protects against prompt size explosion. Claude's match agent sees the full opportunity
descriptions for 150 candidates and scores on 5 dimensions. More than 150 risks
context window bloat and degraded scoring quality.

## Embeddings

- Model: `text-embedding-3-small` (OpenAI, 1536 dimensions)
- Researcher embedding: generated on profile update, stored in `researchers.profile_embedding`
- Opportunity embeddings: generated during ingestion by `data-pipeline/loaders/upsert-opportunities.ts`
- Backfill: `npm run embed -w data-pipeline` for missing vectors
- Embedder: `src/lib/embedder.ts` (app) and `data-pipeline/src/lib/embedder.ts` (pipeline)

## Important constraints

- The **match route** (`src/app/api/session/[name]/match/route.ts`) has NO WebFetch/WebSearch
- All knowledge about opportunities comes from the Supabase retrieval only
- This prevents prompt injection via malicious funder page content

## Related

- [[Pipeline Agents]] · [[Database Schema]] · [[Codebase Index]]
