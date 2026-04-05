-- 005_opportunity_details.sql
-- Add enriched detail-page fields to the opportunities table.
-- These are populated by scraping each opportunity's individual UKRI page.

ALTER TABLE opportunities ADD COLUMN funding_type text;
ALTER TABLE opportunities ADD COLUMN description text;
ALTER TABLE opportunities ADD COLUMN eligibility text;
ALTER TABLE opportunities ADD COLUMN scope text;
