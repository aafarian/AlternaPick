-- Add baseball stat categories for MLB support
ALTER TYPE stat_category ADD VALUE IF NOT EXISTS 'hits';
ALTER TYPE stat_category ADD VALUE IF NOT EXISTS 'home_runs';
ALTER TYPE stat_category ADD VALUE IF NOT EXISTS 'rbis';
ALTER TYPE stat_category ADD VALUE IF NOT EXISTS 'runs';
ALTER TYPE stat_category ADD VALUE IF NOT EXISTS 'stolen_bases';
ALTER TYPE stat_category ADD VALUE IF NOT EXISTS 'total_bases';
ALTER TYPE stat_category ADD VALUE IF NOT EXISTS 'pitcher_strikeouts';
ALTER TYPE stat_category ADD VALUE IF NOT EXISTS 'pitcher_outs';
ALTER TYPE stat_category ADD VALUE IF NOT EXISTS 'hits_runs_rbis';
