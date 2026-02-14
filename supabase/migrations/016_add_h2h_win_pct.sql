-- Add a stored generated column for H2H win percentage so we can sort server-side.
ALTER TABLE leaderboard_entries
  ADD COLUMN h2h_win_pct DECIMAL NOT NULL
  GENERATED ALWAYS AS (
    CASE WHEN (h2h_wins + h2h_losses) > 0
         THEN h2h_wins::decimal / (h2h_wins + h2h_losses)
         ELSE 0
    END
  ) STORED;

CREATE INDEX idx_leaderboard_h2h_win_pct
  ON leaderboard_entries (h2h_win_pct DESC, h2h_wins DESC);
