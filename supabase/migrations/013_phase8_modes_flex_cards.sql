-- 013: Phase 8 - Game Modes, Flexible Cards, Reactions, Referrals
-- Additive migration: all changes use defaults for backward compatibility.
-- Existing 6-pick classic cards remain valid (card_size=6, game_mode='classic').

-- ============================================================
-- 1. cards: add card_size and game_mode columns
-- ============================================================

ALTER TABLE cards ADD COLUMN card_size INT NOT NULL DEFAULT 6;

ALTER TABLE cards ADD COLUMN game_mode TEXT NOT NULL DEFAULT 'classic';

ALTER TABLE cards ADD CONSTRAINT cards_game_mode_check
  CHECK (game_mode IN ('classic', 'sabotage', 'mirror', 'one_player', 'one_team'));

ALTER TABLE cards ADD CONSTRAINT cards_card_size_check
  CHECK (card_size >= 2 AND card_size <= 6);

-- ============================================================
-- 2. challenges: add game_mode, message, mirror_props columns
-- ============================================================

ALTER TABLE challenges ADD COLUMN game_mode TEXT NOT NULL DEFAULT 'classic';

ALTER TABLE challenges ADD CONSTRAINT challenges_game_mode_check
  CHECK (game_mode IN ('classic', 'sabotage', 'mirror', 'one_player', 'one_team'));

ALTER TABLE challenges ADD COLUMN message TEXT;

ALTER TABLE challenges ADD CONSTRAINT challenges_message_length_check
  CHECK (message IS NULL OR char_length(message) <= 200);

ALTER TABLE challenges ADD COLUMN mirror_props JSONB;

-- ============================================================
-- 3. profiles: add referred_by column
-- ============================================================

ALTER TABLE profiles ADD COLUMN referred_by UUID REFERENCES profiles(id);

-- ============================================================
-- 4. reactions table
-- ============================================================

CREATE TABLE reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id   UUID NOT NULL,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reactions_target_type_check
    CHECK (target_type IN ('challenge', 'card')),
  CONSTRAINT reactions_emoji_check
    CHECK (emoji IN ('fire', 'skull', 'crying', 'clown', 'goat')),
  CONSTRAINT reactions_unique_per_user_target
    UNIQUE (user_id, target_type, target_id)
);

-- Index for efficient lookups by target
CREATE INDEX idx_reactions_target ON reactions (target_type, target_id);

-- Index for user's own reactions
CREATE INDEX idx_reactions_user_id ON reactions (user_id);

-- ============================================================
-- 5. RLS policies on reactions
-- ============================================================

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read reactions (needed to display counts/emojis)
CREATE POLICY "reactions_select_authenticated"
  ON reactions FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own reactions
CREATE POLICY "reactions_insert_own"
  ON reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own reactions (change emoji)
CREATE POLICY "reactions_update_own"
  ON reactions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own reactions
CREATE POLICY "reactions_delete_own"
  ON reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 6. Seed "Recruiter" achievement for referral system
-- ============================================================

INSERT INTO achievements (key, name, description, icon, tier, category, threshold) VALUES
  ('recruiter', 'Recruiter', 'Refer a friend who joins SportsTower', '📣', 'standard', 'social', 1)
ON CONFLICT (key) DO NOTHING;
