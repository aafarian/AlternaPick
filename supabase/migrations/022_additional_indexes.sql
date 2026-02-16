-- Additional indexes for query performance

-- Picks: result filtering (analytics queries filter by hit/miss)
CREATE INDEX IF NOT EXISTS idx_picks_result ON picks (result);

-- Games: sport filtering (props page, analytics sport filter)
CREATE INDEX IF NOT EXISTS idx_games_sport ON games (sport);

-- Challenges: status filtering (challenge list, resolution queries)
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges (status);

-- Leaderboard: sort orderings (global leaderboard page)
CREATE INDEX IF NOT EXISTS idx_leaderboard_win_rate ON leaderboard_entries (win_rate DESC, total_correct_picks DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_h2h ON leaderboard_entries (h2h_win_pct DESC, h2h_wins DESC);
