-- Replaces 3 separate COUNT queries per user with a single window function scan.
-- Returns the user's rank and leaderboard entry for the given sort mode.

CREATE OR REPLACE FUNCTION get_user_rank(
  p_user_id UUID,
  p_sort TEXT DEFAULT 'hit_rate'
)
RETURNS TABLE(rank BIGINT)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_sort = 'h2h' THEN
    RETURN QUERY
    SELECT r.rank FROM (
      SELECT
        le.user_id,
        ROW_NUMBER() OVER (
          ORDER BY le.h2h_win_pct DESC, le.h2h_wins DESC, le.win_rate DESC
        ) AS rank
      FROM leaderboard_entries le
    ) r
    WHERE r.user_id = p_user_id;
  ELSE
    RETURN QUERY
    SELECT r.rank FROM (
      SELECT
        le.user_id,
        ROW_NUMBER() OVER (
          ORDER BY le.win_rate DESC, le.total_correct_picks DESC, le.total_cards DESC
        ) AS rank
      FROM leaderboard_entries le
    ) r
    WHERE r.user_id = p_user_id;
  END IF;
END;
$$;
