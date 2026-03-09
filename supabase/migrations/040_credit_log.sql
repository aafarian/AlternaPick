-- Tracks actual Odds API credits consumed per sync run.
-- Replaces the inaccurate props-table inference in get_credit_usage_by_hour
-- which counted 1 per game instead of actual API credits consumed.

CREATE TABLE IF NOT EXISTS credit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credits_consumed INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_log_logged_at ON credit_log (logged_at);

-- Replace the old RPC with one that reads from credit_log when available,
-- falling back to the props-based inference (1 per distinct game/fetched_at)
-- when credit_log has no data yet (transition period after migration).
CREATE OR REPLACE FUNCTION get_credit_usage_by_hour()
RETURNS TABLE(hour TIMESTAMPTZ, credits BIGINT)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  has_credit_log BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM credit_log
    WHERE logged_at >= date_trunc('hour', NOW() - INTERVAL '23 hours')
  ) INTO has_credit_log;

  IF has_credit_log THEN
    RETURN QUERY
    WITH hours AS (
      SELECT generate_series(
        date_trunc('hour', NOW() - INTERVAL '23 hours'),
        date_trunc('hour', NOW()),
        INTERVAL '1 hour'
      ) AS h
    ),
    usage AS (
      SELECT
        date_trunc('hour', cl.logged_at) AS h,
        SUM(cl.credits_consumed)::BIGINT AS credits
      FROM credit_log cl
      WHERE cl.logged_at >= date_trunc('hour', NOW() - INTERVAL '23 hours')
      GROUP BY date_trunc('hour', cl.logged_at)
    )
    SELECT
      hrs.h,
      COALESCE(u.credits, 0)
    FROM hours hrs
    LEFT JOIN usage u ON u.h = hrs.h
    ORDER BY hrs.h;
  ELSE
    -- Fallback: infer from props table (1 per distinct game_id/fetched_at pair)
    RETURN QUERY
    WITH hours AS (
      SELECT generate_series(
        date_trunc('hour', NOW() - INTERVAL '23 hours'),
        date_trunc('hour', NOW()),
        INTERVAL '1 hour'
      ) AS h
    ),
    usage AS (
      SELECT
        date_trunc('hour', p.fetched_at) AS h,
        COUNT(DISTINCT (p.game_id, p.fetched_at)) AS credits
      FROM props p
      WHERE p.fetched_at >= date_trunc('hour', NOW() - INTERVAL '23 hours')
      GROUP BY date_trunc('hour', p.fetched_at)
    )
    SELECT
      hrs.h,
      COALESCE(u.credits, 0)
    FROM hours hrs
    LEFT JOIN usage u ON u.h = hrs.h
    ORDER BY hrs.h;
  END IF;
END;
$$;
