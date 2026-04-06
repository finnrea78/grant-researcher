-- 006_discovery_tracking.sql
-- Add harvest and discovery tracking fields to the funders table.
-- These support the self-improvement loop: every agentic scan persists
-- newly discovered funders and their source URLs so future scans benefit.

ALTER TABLE funders ADD COLUMN source_url text;
  -- The URL we harvest this funder's opportunities from
  -- e.g. "https://wellcome.org/grant-funding/schemes"

ALTER TABLE funders ADD COLUMN discovered_by text DEFAULT 'manual';
  -- 'manual' | 'pipeline' | 'agentic_scan'

ALTER TABLE funders ADD COLUMN discovery_context jsonb DEFAULT '{}';
  -- What led to this funder being discovered, e.g.:
  -- { "disciplines": ["history", "area_studies"], "researcher": "jane-smith" }

ALTER TABLE funders ADD COLUMN last_harvested_at timestamptz;

ALTER TABLE funders ADD COLUMN last_harvest_status text;
  -- 'success' | 'failed' | 'partial'

ALTER TABLE funders ADD COLUMN harvest_count int DEFAULT 0;
