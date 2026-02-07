-- SportsTower Initial Schema
-- Covers all phases (1-5): games, props, cards, picks, challenges, friendships, leaderboard

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE stat_category AS ENUM (
  'points', 'rebounds', 'assists', 'threes', 'blocks', 'steals',
  'turnovers', 'pra', 'pts_reb', 'pts_ast', 'reb_ast', 'blk_stl'
);

CREATE TYPE game_status AS ENUM (
  'scheduled', 'live', 'final', 'postponed', 'cancelled'
);

CREATE TYPE card_status AS ENUM (
  'draft', 'locked', 'resolved'
);

CREATE TYPE pick_selection AS ENUM (
  'over', 'under'
);

CREATE TYPE pick_result AS ENUM (
  'pending', 'hit', 'miss'
);

CREATE TYPE challenge_status AS ENUM (
  'pending', 'accepted', 'declined', 'active', 'resolved', 'cancelled'
);

CREATE TYPE friendship_status AS ENUM (
  'pending', 'accepted', 'blocked'
);

-- ============================================================
-- TABLES
-- ============================================================

-- Extends Supabase auth.users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  odds_api_event_id TEXT UNIQUE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  status game_status NOT NULL DEFAULT 'scheduled',
  home_score INT DEFAULT 0,
  away_score INT DEFAULT 0,
  nba_game_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE props (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_id TEXT,
  stat_category stat_category NOT NULL,
  line DECIMAL NOT NULL,
  over_odds INT,
  under_odds INT,
  bookmaker TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  status challenge_status NOT NULL DEFAULT 'pending',
  winner_id UUID REFERENCES profiles,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  challenge_id UUID REFERENCES challenges ON DELETE SET NULL,
  status card_status NOT NULL DEFAULT 'draft',
  score INT NOT NULL DEFAULT 0,
  total_picks INT NOT NULL DEFAULT 6,
  locked_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards ON DELETE CASCADE,
  prop_id UUID NOT NULL REFERENCES props ON DELETE CASCADE,
  selection pick_selection NOT NULL,
  result pick_result NOT NULL DEFAULT 'pending',
  actual_value DECIMAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id)
);

CREATE TABLE leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles ON DELETE CASCADE,
  total_cards INT NOT NULL DEFAULT 0,
  total_correct_picks INT NOT NULL DEFAULT 0,
  win_rate DECIMAL NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  h2h_wins INT NOT NULL DEFAULT 0,
  h2h_losses INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_games_commence_time ON games (commence_time);
CREATE INDEX idx_games_odds_api_event_id ON games (odds_api_event_id);
CREATE INDEX idx_games_status ON games (status);

CREATE INDEX idx_props_game_id ON props (game_id);
CREATE INDEX idx_props_stat_category ON props (stat_category);
CREATE INDEX idx_props_player_name ON props (player_name);

CREATE INDEX idx_cards_user_id ON cards (user_id);
CREATE INDEX idx_cards_status ON cards (status);
CREATE INDEX idx_cards_challenge_id ON cards (challenge_id);

CREATE INDEX idx_picks_card_id ON picks (card_id);
CREATE INDEX idx_picks_prop_id ON picks (prop_id);

CREATE INDEX idx_challenges_challenger_id ON challenges (challenger_id);
CREATE INDEX idx_challenges_opponent_id ON challenges (opponent_id);
CREATE INDEX idx_challenges_status ON challenges (status);

CREATE INDEX idx_friendships_requester_id ON friendships (requester_id);
CREATE INDEX idx_friendships_addressee_id ON friendships (addressee_id);
CREATE INDEX idx_friendships_status ON friendships (status);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::TEXT, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-create leaderboard entry when profile is created
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO leaderboard_entries (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile();
