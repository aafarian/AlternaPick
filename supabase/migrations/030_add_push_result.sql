-- Add 'push' to pick_result enum for picks that can't be verified
-- (e.g. game finished but no boxscore data / external event ID available)
ALTER TYPE pick_result ADD VALUE IF NOT EXISTS 'push';
