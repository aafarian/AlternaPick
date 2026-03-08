-- RPC: Estimates average Odds API credits used per hour over the last 24h.
-- Each distinct (game_id, fetched_at) pair ≈ 1 fetchEventOdds call = 1 credit.
-- Returns a single row with the hourly average.

CREATE OR REPLACE FUNCTION get_credit_drain_per_hour()
RETURNS TABLE(avg_credits_per_hour DOUBLE PRECISION)
LANGUAGE sql STABLE
AS $$
  WITH hourly AS (
    SELECT
      date_trunc('hour', p.fetched_at) AS hour,
      COUNT(DISTINCT (p.game_id, p.fetched_at)) AS credits
    FROM props p
    WHERE p.fetched_at >= NOW() - INTERVAL '24 hours'
    GROUP BY date_trunc('hour', p.fetched_at)
  )
  SELECT
    ROUND(AVG(credits)::DOUBLE PRECISION, 1) AS avg_credits_per_hour
  FROM hourly;
$$;
