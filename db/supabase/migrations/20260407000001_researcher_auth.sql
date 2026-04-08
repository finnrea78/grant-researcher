-- Add user_id to researchers table for per-user scoping
ALTER TABLE researchers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS researchers_user_id_idx ON researchers(user_id);

-- Drop the open public-read policy
DROP POLICY IF EXISTS "Public read researchers" ON researchers;

-- Scoped RLS policies: users can only access their own rows
CREATE POLICY "Users can select own researchers"
  ON researchers FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own researchers"
  ON researchers FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own researchers"
  ON researchers FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own researchers"
  ON researchers FOR DELETE
  USING (user_id = auth.uid());
