-- RPC: Returns hourly Odds API credit usage for the last 24h.
-- Each distinct (game_id, fetched_at) pair ≈ 1 fetchEventOdds call = 1 credit.
-- Returns one row per hour (including zero-credit hours) so the chart
-- has evenly-spaced points and the average reflects the full 24h window.

CREATE OR REPLACE FUNCTION get_credit_usage_by_hour()
RETURNS TABLE(hour TIMESTAMPTZ, credits BIGINT)
LANGUAGE sql STABLE
AS $$
  WITH hours AS (
    SELECT generate_series(
      date_trunc('hour', NOW() - INTERVAL '23 hours'),
      date_trunc('hour', NOW()),
      INTERVAL '1 hour'
    ) AS hour
  ),
  usage AS (
    SELECT
      date_trunc('hour', p.fetched_at) AS hour,
      COUNT(DISTINCT (p.game_id, p.fetched_at)) AS credits
    FROM props p
    WHERE p.fetched_at >= date_trunc('hour', NOW() - INTERVAL '23 hours')
    GROUP BY date_trunc('hour', p.fetched_at)
  )
  SELECT
    h.hour,
    COALESCE(u.credits, 0) AS credits
  FROM hours h
  LEFT JOIN usage u ON u.hour = h.hour
  ORDER BY h.hour;
$$;
