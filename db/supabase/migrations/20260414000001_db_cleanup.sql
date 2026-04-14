-- Drop dead columns from researchers (write-only, never read back)
ALTER TABLE researchers
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS researcher_id,
  DROP COLUMN IF EXISTS scopus_author_id;

-- Drop funding_sources table — created for DB-first pipeline migration never completed
DROP TRIGGER IF EXISTS funding_sources_updated_at ON funding_sources;
DROP TABLE IF EXISTS funding_sources;

-- Change slug uniqueness from global to per-user
-- Allows two different users to each have a researcher named "Jane Smith"
ALTER TABLE researchers DROP CONSTRAINT IF EXISTS researchers_slug_key;
ALTER TABLE researchers ADD CONSTRAINT researchers_user_slug_unique UNIQUE (user_id, slug);

-- Add proposal_intent as a persistent column (was ephemeral in pipeline_state)
ALTER TABLE researchers ADD COLUMN IF NOT EXISTS proposal_intent jsonb;
