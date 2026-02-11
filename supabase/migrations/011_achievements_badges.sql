-- 011: Achievements & Badges schema
-- Phase 7: Engagement Loop

-- ============================================================
-- 1. achievements table (badge definitions)
-- ============================================================
CREATE TABLE IF NOT EXISTS achievements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text NOT NULL,
  icon        text NOT NULL,
  tier        text DEFAULT 'standard',
  category    text,
  threshold   int,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 2. user_achievements table (unlocked badges per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_achievements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles(id),
  achievement_id uuid NOT NULL REFERENCES achievements(id),
  unlocked_at    timestamptz DEFAULT now(),
  created_at     timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- ============================================================
-- 3. Row Level Security
-- ============================================================

-- achievements: readable by all authenticated users
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievements_select_authenticated"
  ON achievements FOR SELECT
  TO authenticated
  USING (true);

-- user_achievements: users can read their own rows
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_achievements_select_own"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- user_achievements: only service role can insert (server-side achievement engine)
CREATE POLICY "user_achievements_insert_service"
  ON user_achievements FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- 4. Seed 12 initial badge definitions
-- ============================================================
INSERT INTO achievements (key, name, description, icon, tier, category, threshold) VALUES
  ('first_blood',      'First Blood',      'Lock your first card',                               '🩸', 'standard', 'cards',     1),
  ('perfect_six',      'Perfect Six',      'Score 6/6 on a card',                                '💯', 'gold',     'cards',     6),
  ('hot_streak_3',     'On Fire',          '3 winning cards in a row',                           '🔥', 'standard', 'streaks',   3),
  ('hot_streak_5',     'Blazing',          '5 winning cards in a row',                           '🌟', 'gold',     'streaks',   5),
  ('hot_streak_10',    'Unstoppable',      '10 winning cards in a row',                          '⚡', 'legendary','streaks',  10),
  ('century',          'Century Club',     'Lock 100 cards',                                     '🏆', 'gold',     'cards',   100),
  ('sharpshooter',     'Sharpshooter',     '70%+ win rate over 20+ cards',                       '🎯', 'gold',     'accuracy', 20),
  ('rivalry',          'Rival',            'Complete 10 H2H challenges',                         '⚔️', 'standard', 'social',   10),
  ('social_butterfly', 'Social Butterfly', 'Add 5 friends',                                     '🦋', 'standard', 'social',    5),
  ('night_owl',        'Night Owl',        'Lock a card after 10pm local time',                  '🦉', 'standard', 'special', NULL),
  ('prophet',          'Prophet',          'Score 5/6 on a card',                                '🔮', 'standard', 'cards',     5),
  ('underdog',         'Underdog',         'Win H2H when opponent scores higher mid-game',       '🐕', 'standard', 'special', NULL)
ON CONFLICT (key) DO NOTHING;
