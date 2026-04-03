-- 003_researcher_schema.sql
-- Researcher profiles: intake data, ORCID-fetched data, and enriched profiles.

CREATE TABLE researchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  email text,

  -- External identifiers
  orcid text,
  google_scholar_url text,
  researcher_id text,
  scopus_author_id text,
  institutional_profile_url text,

  -- Career
  institution text,
  department text,
  institution_country text,
  career_stage text,

  -- Research (arrays for multi-value fields)
  research_themes text[] DEFAULT '{}',
  research_keywords text[] DEFAULT '{}',
  disciplinary_fields text[] DEFAULT '{}',
  geographic_focus text[] DEFAULT '{}',
  future_research text,
  research_trajectory text,

  -- Structured sub-objects stored as JSONB
  funding_goals jsonb DEFAULT '{}',
  collaboration jsonb DEFAULT '{}',
  eligibility jsonb DEFAULT '{}',

  -- Optional CV text
  cv_text text,

  -- ORCID cache
  orcid_data jsonb,
  orcid_fetched_at timestamptz,

  -- Enriched profile (full ResearcherProfile JSON built by Claude)
  enriched_profile jsonb,
  enriched_at timestamptz,

  -- Audit
  intake_source text DEFAULT 'web_form',
  intake_completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_researchers_orcid ON researchers(orcid) WHERE orcid IS NOT NULL;
CREATE INDEX idx_researchers_career_stage ON researchers(career_stage);
CREATE INDEX idx_researchers_institution ON researchers(institution);
CREATE INDEX idx_researchers_intake_source ON researchers(intake_source);

-- RLS: enabled, public read (matches funders/schemes pattern)
ALTER TABLE researchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read researchers" ON researchers FOR SELECT USING (true);

-- Auto-update updated_at (reuses function defined in 001_grant_schema.sql)
CREATE TRIGGER researchers_updated_at
  BEFORE UPDATE ON researchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
