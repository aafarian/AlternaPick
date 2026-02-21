-- 026: Add weekly_data column to recaps table
-- Stores computed weekly recap/callout data (jsonb, nullable).
-- Only the most recent day's recap for a given week will have weekly_data populated;
-- all other rows remain NULL.

ALTER TABLE recaps ADD COLUMN IF NOT EXISTS weekly_data jsonb DEFAULT NULL;
