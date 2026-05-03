-- Add flame_tokens sort to get_user_rank and filter to wagered users only.

CREATE OR REPLACE FUNCTION get_user_rank(
  p_user_id UUID,
  p_sort TEXT DEFAULT 'hit_rate'
)
RETURNS TABLE(rank BIGINT)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_sort = 'flame_tokens' THEN
    -- Flame ranking: only users who have wagered at least once
    RETURN QUERY
    SELECT r.rank FROM (
      SELECT
        le.user_id,
        ROW_NUMBER() OVER (
          ORDER BY le.fire_tokens_balance DESC, le.fire_tokens_lifetime DESC, le.total_cards DESC
        ) AS rank
      FROM leaderboard_entries le
      WHERE EXISTS (
        SELECT 1 FROM cards c
        WHERE c.user_id = le.user_id
          AND c.fire_token_wager IS NOT NULL
      )
    ) r
    WHERE r.user_id = p_user_id;
  ELSIF p_sort = 'h2h' THEN
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
