-- 001_grant_schema.sql
-- Grant database schema for storing funder and scheme data from multiple sources.

-- Funders: funding bodies (AHRC, Leverhulme, Wellcome, etc.)
CREATE TABLE funders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  website text,
  type text,
  disciplines text[] DEFAULT '{}',
  source_metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Schemes: individual funding opportunities or awarded grants
CREATE TABLE schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_id uuid NOT NULL REFERENCES funders(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  status text,
  deadline_raw text,
  deadline_date date,
  amount_raw text,
  amount_min integer,
  amount_max integer,
  amount_currency text DEFAULT 'GBP',
  duration text,
  career_stage text,
  institutional_eligibility text,
  thematic_priorities text,
  application_process text,
  url text,
  grant_reference text UNIQUE,
  source text NOT NULL,
  source_metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(funder_id, slug)
);

CREATE INDEX idx_schemes_funder_id ON schemes(funder_id);
CREATE INDEX idx_schemes_status ON schemes(status);
CREATE INDEX idx_schemes_deadline_date ON schemes(deadline_date);
CREATE INDEX idx_schemes_source ON schemes(source);

-- Classifications: research subjects/topics from GtR
CREATE TABLE scheme_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id uuid NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  type text NOT NULL,
  name text NOT NULL,
  percentage integer
);

CREATE INDEX idx_scheme_classifications_scheme_id ON scheme_classifications(scheme_id);

-- Ingestion runs: audit trail
CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  funder_slug text,
  status text NOT NULL DEFAULT 'running',
  records_created integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  records_skipped integer DEFAULT 0,
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- RLS: public read on grant tables, no frontend writes
ALTER TABLE funders ENABLE ROW LEVEL SECURITY;
ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheme_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read funders" ON funders FOR SELECT USING (true);
CREATE POLICY "Public read schemes" ON schemes FOR SELECT USING (true);
CREATE POLICY "Public read classifications" ON scheme_classifications FOR SELECT USING (true);
-- ingestion_runs: no public access (service role only)

-- Auto-update updated_at on funders and schemes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER funders_updated_at
  BEFORE UPDATE ON funders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER schemes_updated_at
  BEFORE UPDATE ON schemes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
