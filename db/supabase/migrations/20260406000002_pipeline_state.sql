-- 20260406000002_pipeline_state.sql
-- Add pipeline state tracking columns to researchers and create researcher_proposals table.

-- Add columns to researchers for pipeline state and agent outputs
ALTER TABLE researchers
  ADD COLUMN IF NOT EXISTS publications_md text,
  ADD COLUMN IF NOT EXISTS match_results_md text,
  ADD COLUMN IF NOT EXISTS scholar_candidate jsonb,
  ADD COLUMN IF NOT EXISTS pipeline_state jsonb NOT NULL DEFAULT '{}'::jsonb;

-- proposals written by the propose agent, keyed by researcher + funder + scheme
CREATE TABLE researcher_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  researcher_id uuid NOT NULL REFERENCES researchers(id) ON DELETE CASCADE,
  funder_slug text NOT NULL,
  scheme_slug text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (researcher_id, funder_slug, scheme_slug)
);

-- RLS: enabled, public read (matches researchers/funders/schemes pattern)
ALTER TABLE researcher_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read researcher_proposals" ON researcher_proposals FOR SELECT USING (true);

-- Auto-update updated_at (reuses function defined in 001_grant_schema.sql)
CREATE TRIGGER researcher_proposals_updated_at
  BEFORE UPDATE ON researcher_proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
