-- Add daily claim tracking column to leaderboard_entries.
-- Stores the UTC date (YYYY-MM-DD) of the user's last daily claim.
-- NULL means never claimed.

ALTER TABLE leaderboard_entries
  ADD COLUMN IF NOT EXISTS fire_tokens_last_claim DATE;
