-- Tracks which daily quest rewards have been credited to avoid double-paying.
-- Quest completion is computed on read from existing tables (friendships, challenges, cards).
-- This table only records that the reward was paid out.

CREATE TABLE IF NOT EXISTS quest_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_key TEXT NOT NULL,
  reward_date DATE NOT NULL DEFAULT CURRENT_DATE,
  coins_awarded INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, quest_key, reward_date)
);

CREATE INDEX IF NOT EXISTS idx_quest_rewards_user_date ON quest_rewards (user_id, reward_date);

ALTER TABLE quest_rewards ENABLE ROW LEVEL SECURITY;

-- Service role: full access (server credits rewards)
CREATE POLICY quest_rewards_service_all ON quest_rewards
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users: read own rewards
CREATE POLICY quest_rewards_select_own ON quest_rewards
  FOR SELECT TO authenticated USING (user_id = auth.uid());
