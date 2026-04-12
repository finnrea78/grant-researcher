-- 20260412000001_researcher_matches.sql
-- Structured match scores per researcher, replacing the filesystem matches.md pattern.
-- Closes: #50, part of #52

CREATE TABLE researcher_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  researcher_id uuid NOT NULL REFERENCES researchers(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES opportunities(id),
  funder_slug text NOT NULL,
  scheme_slug text NOT NULL,
  score_overall numeric NOT NULL,
  score_thematic numeric,
  score_track_record numeric,
  score_strategic numeric,
  score_practical numeric,
  eligible boolean NOT NULL DEFAULT true,
  tier text,
  why text,
  strengths text[],
  weaknesses text[],
  action text,
  urgent boolean NOT NULL DEFAULT false,
  amount_raw text,
  deadline_raw text,
  url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (researcher_id, funder_slug, scheme_slug)
);

-- RLS: users can only access matches for their own researchers
ALTER TABLE researcher_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own matches"
  ON researcher_matches FOR SELECT
  USING (
    researcher_id IN (SELECT id FROM researchers WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own matches"
  ON researcher_matches FOR INSERT
  WITH CHECK (
    researcher_id IN (SELECT id FROM researchers WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own matches"
  ON researcher_matches FOR UPDATE
  USING (
    researcher_id IN (SELECT id FROM researchers WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own matches"
  ON researcher_matches FOR DELETE
  USING (
    researcher_id IN (SELECT id FROM researchers WHERE user_id = auth.uid())
  );
