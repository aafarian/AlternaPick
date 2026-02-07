-- Phase 3: Authentication & RLS Policies
-- Adds anon_id column to cards, enables RLS on all tables, creates policies

-- 1. Add anon_id column to cards for anonymous card tracking
ALTER TABLE cards ADD COLUMN anon_id TEXT;

-- 2. Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE props ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- 3. Profiles: anyone can read, users can update their own
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 4. Games: public read-only
CREATE POLICY "games_select_all" ON games FOR SELECT USING (true);
CREATE POLICY "games_insert_service" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "games_update_service" ON games FOR UPDATE USING (true);

-- 5. Props: public read-only
CREATE POLICY "props_select_all" ON props FOR SELECT USING (true);
CREATE POLICY "props_insert_service" ON props FOR INSERT WITH CHECK (true);
CREATE POLICY "props_delete_service" ON props FOR DELETE USING (true);

-- 6. Cards: users can manage their own, anon users can read by anon_id
CREATE POLICY "cards_select_own" ON cards FOR SELECT USING (
  auth.uid() = user_id
  OR (user_id IS NULL AND anon_id IS NOT NULL)
);
CREATE POLICY "cards_insert_auth" ON cards FOR INSERT WITH CHECK (
  auth.uid() = user_id OR user_id IS NULL
);
CREATE POLICY "cards_update_own" ON cards FOR UPDATE USING (
  auth.uid() = user_id OR user_id IS NULL
);

-- 7. Picks: users can manage picks on their own cards
CREATE POLICY "picks_select_own" ON picks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM cards WHERE cards.id = picks.card_id
    AND (cards.user_id = auth.uid() OR cards.user_id IS NULL)
  )
);
CREATE POLICY "picks_insert_own" ON picks FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM cards WHERE cards.id = picks.card_id
    AND (cards.user_id = auth.uid() OR cards.user_id IS NULL)
  )
);
CREATE POLICY "picks_update_service" ON picks FOR UPDATE USING (true);

-- 8. Challenges: participants can view and manage
CREATE POLICY "challenges_select_participant" ON challenges FOR SELECT USING (
  auth.uid() = challenger_id OR auth.uid() = opponent_id
);
CREATE POLICY "challenges_insert_auth" ON challenges FOR INSERT WITH CHECK (
  auth.uid() = challenger_id
);
CREATE POLICY "challenges_update_participant" ON challenges FOR UPDATE USING (
  auth.uid() = challenger_id OR auth.uid() = opponent_id
);

-- 9. Friendships: participants can view and manage
CREATE POLICY "friendships_select_participant" ON friendships FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = addressee_id
);
CREATE POLICY "friendships_insert_auth" ON friendships FOR INSERT WITH CHECK (
  auth.uid() = requester_id
);
CREATE POLICY "friendships_update_participant" ON friendships FOR UPDATE USING (
  auth.uid() = requester_id OR auth.uid() = addressee_id
);

-- 10. Leaderboard: public read, users update own
CREATE POLICY "leaderboard_select_all" ON leaderboard_entries FOR SELECT USING (true);
CREATE POLICY "leaderboard_update_own" ON leaderboard_entries FOR UPDATE USING (
  auth.uid() = user_id
);
