-- Tracks actual Odds API credits consumed per sync run.
-- Replaces the inaccurate props-table inference in get_credit_usage_by_hour
-- which counted 1 per game instead of actual API credits consumed.

CREATE TABLE IF NOT EXISTS credit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credits_consumed INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_log_logged_at ON credit_log (logged_at);

-- RLS: only service_role (server-side admin client) can read/write credit data
ALTER TABLE credit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_log_select_service"
  ON credit_log FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "credit_log_insert_service"
  ON credit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Replace the old RPC (which inferred credits from props rows) with one
-- that reads actual recorded credit usage from credit_log.
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
      date_trunc('hour', cl.logged_at) AS hour,
      SUM(cl.credits_consumed)::BIGINT AS credits
    FROM credit_log cl
    WHERE cl.logged_at >= date_trunc('hour', NOW() - INTERVAL '23 hours')
    GROUP BY date_trunc('hour', cl.logged_at)
  )
  SELECT
    h.hour,
    COALESCE(u.credits, 0) AS credits
  FROM hours h
  LEFT JOIN usage u ON u.hour = h.hour
  ORDER BY h.hour;
$$;
