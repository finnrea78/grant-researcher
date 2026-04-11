-- Add funder_name to both retrieval RPCs so the matcher agent uses the
-- real funder name from the DB instead of guessing it from descriptions.
-- Must DROP before CREATE OR REPLACE because the return type changes.

DROP FUNCTION IF EXISTS match_opportunities(vector, float, int);
DROP FUNCTION IF EXISTS search_opportunities_fts(text, int);

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
  similarity float,
  funder_name text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    o.id, o.funder_id, o.name, o.slug, o.status,
    o.description, o.eligibility, o.scope,
    o.amount_raw, o.amount_min, o.amount_max, o.amount_currency,
    o.deadline_raw, o.deadline_date, o.url, o.funding_type, o.source,
    1 - (o.embedding <=> query_embedding) AS similarity,
    f.name AS funder_name
  FROM opportunities o
  JOIN funders f ON f.id = o.funder_id
  WHERE
    o.status = 'open'
    AND o.embedding IS NOT NULL
    AND 1 - (o.embedding <=> query_embedding) > match_threshold
  ORDER BY o.embedding <=> query_embedding
  LIMIT match_count;
$$;

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
  rank float4,
  funder_name text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    o.id, o.funder_id, o.name, o.slug, o.status,
    o.description, o.eligibility, o.scope,
    o.amount_raw, o.amount_min, o.amount_max, o.amount_currency,
    o.deadline_raw, o.deadline_date, o.url, o.funding_type, o.source,
    ts_rank(o.fts, to_tsquery('english', search_query)) AS rank,
    f.name AS funder_name
  FROM opportunities o
  JOIN funders f ON f.id = o.funder_id
  WHERE
    o.status = 'open'
    AND o.fts IS NOT NULL
    AND o.fts @@ to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT match_count;
$$;
