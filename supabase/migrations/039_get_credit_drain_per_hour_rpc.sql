-- RPC: Returns hourly Odds API credit usage for the last 24h.
-- Each distinct (game_id, fetched_at) pair ≈ 1 fetchEventOdds call = 1 credit.
-- Returns one row per hour with the timestamp and credit count.

CREATE OR REPLACE FUNCTION get_credit_usage_by_hour()
RETURNS TABLE(hour TIMESTAMPTZ, credits BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT
    date_trunc('hour', p.fetched_at) AS hour,
    COUNT(DISTINCT (p.game_id, p.fetched_at)) AS credits
  FROM props p
  WHERE p.fetched_at >= NOW() - INTERVAL '24 hours'
  GROUP BY date_trunc('hour', p.fetched_at)
  ORDER BY hour;
$$;
