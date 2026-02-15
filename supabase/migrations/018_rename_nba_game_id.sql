-- Rename misleading column: nba_game_id stores external event IDs for ALL sports
ALTER TABLE games RENAME COLUMN nba_game_id TO external_event_id;
