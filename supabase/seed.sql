-- SportsTower Seed Data
-- Sample games and props for development/testing

-- Sample Games (NBA games for tonight)
INSERT INTO games (id, odds_api_event_id, home_team, away_team, commence_time, status) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'nba_20260206_lal_bos', 'Boston Celtics', 'Los Angeles Lakers', '2026-02-07 00:30:00+00', 'scheduled'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'nba_20260206_gsw_dal', 'Dallas Mavericks', 'Golden State Warriors', '2026-02-07 01:00:00+00', 'scheduled'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'nba_20260206_den_phx', 'Phoenix Suns', 'Denver Nuggets', '2026-02-07 02:00:00+00', 'scheduled');

-- Props for Game 1: Celtics vs Lakers
INSERT INTO props (game_id, player_name, stat_category, line, over_odds, under_odds, bookmaker) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'LeBron James', 'points', 25.5, -115, -105, 'draftkings'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'LeBron James', 'rebounds', 7.5, -110, -110, 'draftkings'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'LeBron James', 'assists', 7.5, -120, 100, 'draftkings'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Jayson Tatum', 'points', 27.5, -110, -110, 'fanduel'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Jayson Tatum', 'rebounds', 8.5, 105, -125, 'fanduel'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Jayson Tatum', 'threes', 2.5, -130, 110, 'fanduel'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Anthony Davis', 'points', 24.5, -110, -110, 'draftkings'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Anthony Davis', 'rebounds', 11.5, -105, -115, 'draftkings'),
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Anthony Davis', 'blocks', 2.5, 120, -140, 'draftkings');

-- Props for Game 2: Mavericks vs Warriors
INSERT INTO props (game_id, player_name, stat_category, line, over_odds, under_odds, bookmaker) VALUES
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Stephen Curry', 'points', 28.5, -105, -115, 'fanduel'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Stephen Curry', 'threes', 4.5, -110, -110, 'fanduel'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Stephen Curry', 'assists', 5.5, -115, -105, 'fanduel'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Luka Doncic', 'points', 30.5, -110, -110, 'draftkings'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Luka Doncic', 'rebounds', 9.5, -120, 100, 'draftkings'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Luka Doncic', 'assists', 8.5, -115, -105, 'draftkings'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Luka Doncic', 'pra', 48.5, -110, -110, 'draftkings');

-- Props for Game 3: Suns vs Nuggets
INSERT INTO props (game_id, player_name, stat_category, line, over_odds, under_odds, bookmaker) VALUES
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Nikola Jokic', 'points', 26.5, -115, -105, 'draftkings'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Nikola Jokic', 'rebounds', 12.5, -110, -110, 'draftkings'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Nikola Jokic', 'assists', 9.5, -105, -115, 'draftkings'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Nikola Jokic', 'pra', 48.5, -120, 100, 'draftkings'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Kevin Durant', 'points', 27.5, -110, -110, 'fanduel'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Kevin Durant', 'rebounds', 6.5, -105, -115, 'fanduel'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Devin Booker', 'points', 25.5, -110, -110, 'fanduel'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Devin Booker', 'threes', 2.5, -105, -115, 'fanduel');
