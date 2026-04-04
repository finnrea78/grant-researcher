-- 004_split_schemes.sql
-- Split the schemes table into opportunities (open calls) and awarded_grants (GtR history).

-- 1. Create opportunities table (open funding calls — UKRI Finder)
CREATE TABLE opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_id uuid NOT NULL REFERENCES funders(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  status text,
  deadline_raw text,
  deadline_date date,
  amount_raw text,
  amount_min bigint,
  amount_max bigint,
  amount_currency text DEFAULT 'GBP',
  url text,
  source text NOT NULL,
  source_metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(funder_id, slug)
);

CREATE INDEX idx_opportunities_funder_id ON opportunities(funder_id);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_deadline_date ON opportunities(deadline_date);

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read opportunities" ON opportunities FOR SELECT USING (true);

CREATE TRIGGER opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Create awarded_grants table (historical funded projects — GtR)
CREATE TABLE awarded_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_id uuid NOT NULL REFERENCES funders(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  grant_reference text UNIQUE,
  status text,
  abstract text,
  technical_summary text,
  impact_text text,
  grant_category text,
  fund_start date,
  fund_end date,
  amount bigint,
  amount_currency text DEFAULT 'GBP',
  url text,
  source text NOT NULL DEFAULT 'gtr',
  source_metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_awarded_grants_funder_id ON awarded_grants(funder_id);
CREATE INDEX idx_awarded_grants_grant_reference ON awarded_grants(grant_reference);
CREATE INDEX idx_awarded_grants_fund_start ON awarded_grants(fund_start);
CREATE INDEX idx_awarded_grants_status ON awarded_grants(status);

ALTER TABLE awarded_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read awarded_grants" ON awarded_grants FOR SELECT USING (true);

CREATE TRIGGER awarded_grants_updated_at
  BEFORE UPDATE ON awarded_grants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Migrate UKRI Finder records to opportunities
INSERT INTO opportunities (funder_id, name, slug, status, deadline_raw, deadline_date, amount_raw, amount_min, amount_max, amount_currency, url, source, source_metadata, created_at, updated_at)
SELECT funder_id, name, slug, status, deadline_raw, deadline_date, amount_raw, amount_min, amount_max, amount_currency, url, source, source_metadata, created_at, updated_at
FROM schemes
WHERE source = 'ukri_funding_finder';

-- 4. Migrate GtR records to awarded_grants (classifications rebuilt on next ingest)
INSERT INTO awarded_grants (funder_id, name, slug, grant_reference, status, url, source, source_metadata, created_at, updated_at)
SELECT funder_id, name, slug, grant_reference, status, url, source, source_metadata, created_at, updated_at
FROM schemes
WHERE source = 'gtr';

-- 5. Drop old tables (CASCADE removes scheme_classifications and its constraints)
DROP TABLE scheme_classifications;
DROP TABLE schemes;

-- 6. Create grant_classifications pointing at awarded_grants
CREATE TABLE grant_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  awarded_grant_id uuid NOT NULL REFERENCES awarded_grants(id) ON DELETE CASCADE,
  type text NOT NULL,
  name text NOT NULL,
  percentage integer
);

CREATE INDEX idx_grant_classifications_grant_id ON grant_classifications(awarded_grant_id);

ALTER TABLE grant_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read grant_classifications" ON grant_classifications FOR SELECT USING (true);
