-- Add Fire Token columns to cards and leaderboard_entries.
--
-- cards.fire_token_wager: how many tokens the user wagered on this card.
--   NULL for cards created before Fire Tokens or free-play cards.
-- cards.fire_token_payout: tokens returned after resolution.
--   NULL until resolved.
--
-- leaderboard_entries.fire_tokens_balance: spendable balance (goes up/down).
--   Starts at 1000 for new users, refilled weekly.
-- leaderboard_entries.fire_tokens_lifetime: total tokens earned (only goes up).
--   This is the leaderboard ranking metric.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS fire_token_wager INTEGER,
  ADD COLUMN IF NOT EXISTS fire_token_payout INTEGER;

ALTER TABLE leaderboard_entries
  ADD COLUMN IF NOT EXISTS fire_tokens_balance INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS fire_tokens_lifetime INTEGER NOT NULL DEFAULT 0;
