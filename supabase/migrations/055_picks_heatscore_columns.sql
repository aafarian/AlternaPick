-- Add HeatScore columns to picks and cards tables.
--
-- picks.notch: the user's chosen notch (-2 to +3), default 0 (standard line)
-- picks.adjusted_line: the shifted line used for resolution. NULL means "use
--   props.line" — backward compatible for all existing picks.
-- picks.heat_score: signed HeatScore after resolution. NULL while pending.
--
-- cards.heat_score: card-level final HeatScore (after multiplier). NULL for
--   cards resolved before HeatScore was enabled.

ALTER TABLE picks
  ADD COLUMN IF NOT EXISTS notch SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjusted_line NUMERIC,
  ADD COLUMN IF NOT EXISTS heat_score INTEGER;

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS heat_score INTEGER;
