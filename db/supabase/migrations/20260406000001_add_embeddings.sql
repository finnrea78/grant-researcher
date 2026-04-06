-- db/supabase/migrations/20260406000001_add_embeddings.sql

-- pgvector extension (already available on all Supabase projects)
CREATE EXTENSION IF NOT EXISTS vector;

-- Semantic embedding for each opportunity (computed at ingest time)
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Full-text search — generated column, auto-maintained by Postgres on every insert/update
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(scope, '') || ' ' ||
      coalesce(eligibility, ''))
  ) STORED;

-- HNSW index: approximate nearest-neighbor, no training step needed
CREATE INDEX IF NOT EXISTS idx_opportunities_embedding
  ON opportunities USING hnsw (embedding vector_cosine_ops);

-- GIN index for fast tsvector queries
CREATE INDEX IF NOT EXISTS idx_opportunities_fts
  ON opportunities USING gin (fts);

-- Researcher profile embedding (computed from Claude-generated retrieval_summary)
ALTER TABLE researchers ADD COLUMN IF NOT EXISTS profile_embedding vector(1536);

-- RPC: pgvector similarity search
-- Called from opportunity-retrieval.ts when researcher has a profile_embedding
CREATE OR REPLACE FUNCTION match_opportunities(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  funder_id uuid,
  name text,
  slug text,
  status text,
  description text,
  eligibility text,
  scope text,
  amount_raw text,
  amount_min bigint,
  amount_max bigint,
  amount_currency text,
  deadline_raw text,
  deadline_date date,
  url text,
  funding_type text,
  source text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, funder_id, name, slug, status,
    description, eligibility, scope,
    amount_raw, amount_min, amount_max, amount_currency,
    deadline_raw, deadline_date, url, funding_type, source,
    1 - (embedding <=> query_embedding) AS similarity
  FROM opportunities
  WHERE
    status = 'open'
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- RPC: tsvector full-text search with OR-joined keywords
-- Called from opportunity-retrieval.ts as belt-and-braces fallback
CREATE OR REPLACE FUNCTION search_opportunities_fts(
  search_query text,
  match_count int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  funder_id uuid,
  name text,
  slug text,
  status text,
  description text,
  eligibility text,
  scope text,
  amount_raw text,
  amount_min bigint,
  amount_max bigint,
  amount_currency text,
  deadline_raw text,
  deadline_date date,
  url text,
  funding_type text,
  source text,
  rank float4
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, funder_id, name, slug, status,
    description, eligibility, scope,
    amount_raw, amount_min, amount_max, amount_currency,
    deadline_raw, deadline_date, url, funding_type, source,
    ts_rank(fts, to_tsquery('english', search_query)) AS rank
  FROM opportunities
  WHERE
    status = 'open'
    AND fts IS NOT NULL
    AND fts @@ to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT match_count;
$$;
