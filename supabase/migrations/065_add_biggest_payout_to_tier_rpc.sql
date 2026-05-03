-- Add biggest_payout to get_tier_hit_rates (was added to migration 062
-- after it was already deployed, so the DB function is missing it).
-- Must DROP first because return type is changing (added column).

DROP FUNCTION IF EXISTS get_tier_hit_rates();

CREATE OR REPLACE FUNCTION get_tier_hit_rates()
RETURNS TABLE (
  user_id UUID,
  standard_hits INT,
  standard_total INT,
  frosty_hits INT,
  frosty_total INT,
  chilled_hits INT,
  chilled_total INT,
  heated_hits INT,
  heated_total INT,
  scorched_hits INT,
  scorched_total INT,
  volcanic_hits INT,
  volcanic_total INT,
  has_wagered BOOLEAN,
  biggest_payout INT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.user_id,
    COUNT(*) FILTER (WHERE p.result = 'hit' AND COALESCE(p.notch, 0) = 0)::INT AS standard_hits,
    COUNT(*) FILTER (WHERE p.result IN ('hit', 'miss') AND COALESCE(p.notch, 0) = 0)::INT AS standard_total,
    COUNT(*) FILTER (WHERE p.result = 'hit' AND p.notch = -2)::INT AS frosty_hits,
    COUNT(*) FILTER (WHERE p.result IN ('hit', 'miss') AND p.notch = -2)::INT AS frosty_total,
    COUNT(*) FILTER (WHERE p.result = 'hit' AND p.notch = -1)::INT AS chilled_hits,
    COUNT(*) FILTER (WHERE p.result IN ('hit', 'miss') AND p.notch = -1)::INT AS chilled_total,
    COUNT(*) FILTER (WHERE p.result = 'hit' AND p.notch = 1)::INT AS heated_hits,
    COUNT(*) FILTER (WHERE p.result IN ('hit', 'miss') AND p.notch = 1)::INT AS heated_total,
    COUNT(*) FILTER (WHERE p.result = 'hit' AND p.notch = 2)::INT AS scorched_hits,
    COUNT(*) FILTER (WHERE p.result IN ('hit', 'miss') AND p.notch = 2)::INT AS scorched_total,
    COUNT(*) FILTER (WHERE p.result = 'hit' AND p.notch = 3)::INT AS volcanic_hits,
    COUNT(*) FILTER (WHERE p.result IN ('hit', 'miss') AND p.notch = 3)::INT AS volcanic_total,
    BOOL_OR(c.fire_token_wager IS NOT NULL) AS has_wagered,
    -- Biggest payout excluding refunds (total_picks > 0 means at least one scoreable pick)
    COALESCE(MAX(c.fire_token_payout) FILTER (WHERE c.fire_token_payout > 0 AND c.total_picks > 0), 0)::INT AS biggest_payout
  FROM cards c
  JOIN picks p ON p.card_id = c.id
  WHERE c.status = 'resolved'
    AND c.user_id IS NOT NULL
  GROUP BY c.user_id;
$$;
