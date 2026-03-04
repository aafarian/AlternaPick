-- Add period and clock columns to games table.
-- These are updated by the sync endpoint and provide a fallback
-- when the live stats service is unavailable (timeout, circuit breaker).
ALTER TABLE games ADD COLUMN IF NOT EXISTS period INT NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS clock TEXT NOT NULL DEFAULT '';
