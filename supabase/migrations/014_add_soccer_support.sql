-- Add sport column to games table
ALTER TABLE games ADD COLUMN sport TEXT NOT NULL DEFAULT 'nba';
CREATE INDEX idx_games_sport ON games (sport);

-- Extend stat_category enum with soccer stats
ALTER TYPE stat_category ADD VALUE 'shots';
ALTER TYPE stat_category ADD VALUE 'shots_on_target';
ALTER TYPE stat_category ADD VALUE 'tackles';
ALTER TYPE stat_category ADD VALUE 'passes';
ALTER TYPE stat_category ADD VALUE 'goals';
ALTER TYPE stat_category ADD VALUE 'fouls_committed';
ALTER TYPE stat_category ADD VALUE 'saves';
