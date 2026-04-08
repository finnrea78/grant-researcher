-- 20260408000001_researcher_proposals_rls.sql
-- Add user-scoped RLS policies to researcher_proposals table.
-- The table already exists (20260406000002) with only a public SELECT policy.
-- Replace with per-user policies matching the researchers table pattern.

-- Drop the open public-read policy
DROP POLICY IF EXISTS "Public read researcher_proposals" ON researcher_proposals;

-- Users can only read proposals belonging to their own researchers
CREATE POLICY "Users can select own proposals"
  ON researcher_proposals FOR SELECT
  USING (
    researcher_id IN (SELECT id FROM researchers WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own proposals"
  ON researcher_proposals FOR INSERT
  WITH CHECK (
    researcher_id IN (SELECT id FROM researchers WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own proposals"
  ON researcher_proposals FOR UPDATE
  USING (
    researcher_id IN (SELECT id FROM researchers WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own proposals"
  ON researcher_proposals FOR DELETE
  USING (
    researcher_id IN (SELECT id FROM researchers WHERE user_id = auth.uid())
  );
