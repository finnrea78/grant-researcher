-- Widen amount columns from integer to bigint to support large grants (>£21m)
ALTER TABLE schemes
  ALTER COLUMN amount_min TYPE bigint,
  ALTER COLUMN amount_max TYPE bigint;
