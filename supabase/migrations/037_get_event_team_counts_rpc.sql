-- RPC: Returns per-team prop counts for upcoming games, used by the polling
-- skip logic to avoid fetching all individual prop rows client-side.
-- Groups by (game event ID, player_team) so the caller gets at most
-- 2-3 rows per game instead of hundreds.

CREATE OR REPLACE FUNCTION get_event_team_counts(
  range_start TIMESTAMPTZ,
  range_end TIMESTAMPTZ
)
RETURNS TABLE(
  odds_api_event_id TEXT,
  player_team TEXT,
  cnt BIGINT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    g.odds_api_event_id,
    p.player_team,
    COUNT(*) AS cnt
  FROM games g
  JOIN props p ON p.game_id = g.id
  WHERE g.commence_time >= range_start
    AND g.commence_time <= range_end
    AND g.odds_api_event_id IS NOT NULL
  GROUP BY g.odds_api_event_id, p.player_team;
$$;
