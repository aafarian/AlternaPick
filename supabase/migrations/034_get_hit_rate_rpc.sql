-- RPC: Single source of truth for hit rate across picks page and analytics page.
-- Counts hits and total scored picks (hit + miss) for a user's resolved cards.
-- DNP and push picks are excluded from the count (they are not scoreable).

CREATE OR REPLACE FUNCTION get_hit_rate(p_user_id UUID)
RETURNS TABLE(hits BIGINT, total BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT
    COUNT(*) FILTER (WHERE p.result = 'hit'),
    COUNT(*) FILTER (WHERE p.result IN ('hit', 'miss'))
  FROM picks p
  JOIN cards c ON c.id = p.card_id
  WHERE c.user_id = p_user_id AND c.status = 'resolved';
$$;
