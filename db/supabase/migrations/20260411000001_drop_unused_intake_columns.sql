-- Drop intake columns no longer collected by the simplified wizard
-- research_themes and research_keywords are kept (written by enrichment step)
-- eligibility is kept (still collected in wizard step 1)
ALTER TABLE researchers
  DROP COLUMN IF EXISTS disciplinary_fields,
  DROP COLUMN IF EXISTS geographic_focus,
  DROP COLUMN IF EXISTS future_research,
  DROP COLUMN IF EXISTS research_trajectory,
  DROP COLUMN IF EXISTS funding_goals,
  DROP COLUMN IF EXISTS collaboration;
