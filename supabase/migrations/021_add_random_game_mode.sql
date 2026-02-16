-- Add 'random' to the game_mode check constraints on challenges and cards tables
ALTER TABLE challenges DROP CONSTRAINT challenges_game_mode_check;
ALTER TABLE challenges ADD CONSTRAINT challenges_game_mode_check
  CHECK (game_mode IN ('classic', 'sabotage', 'mirror', 'random', 'one_player', 'one_team'));

ALTER TABLE cards DROP CONSTRAINT cards_game_mode_check;
ALTER TABLE cards ADD CONSTRAINT cards_game_mode_check
  CHECK (game_mode IN ('classic', 'sabotage', 'mirror', 'random', 'one_player', 'one_team'));
