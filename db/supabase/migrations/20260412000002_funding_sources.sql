-- 20260412000002_funding_sources.sql
-- Funder markdown content table, replacing data/funding-sources/*.md files.
-- Part of #52: DB-first pipeline.

CREATE TABLE funding_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  content_md text NOT NULL,
  source_url text,
  discovered_at timestamptz DEFAULT now(),
  last_harvested timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: public read (reference data, same as funders/opportunities)
ALTER TABLE funding_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read funding_sources" ON funding_sources FOR SELECT USING (true);

-- Auto-update updated_at (reuses function defined in 001_grant_schema.sql)
CREATE TRIGGER funding_sources_updated_at
  BEFORE UPDATE ON funding_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
