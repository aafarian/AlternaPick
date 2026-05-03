-- Compute per-notch-tier hit rates for leaderboard display.
-- Returns one row per user with hit rates broken down by notch tier,
-- plus a "standard only" hit rate that excludes notched picks.

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
  has_wagered BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.user_id,
    -- Standard (notch = 0 or NULL): only non-notched picks
    COUNT(*) FILTER (WHERE p.result = 'hit' AND COALESCE(p.notch, 0) = 0)::INT AS standard_hits,
    COUNT(*) FILTER (WHERE p.result IN ('hit', 'miss') AND COALESCE(p.notch, 0) = 0)::INT AS standard_total,
    -- Frosty (notch = -2)
    COUNT(*) FILTER (WHERE p.result = 'hit' AND p.notch = -2)::INT AS frosty_hits,
    COUNT(*) FILTER (WHERE p.result IN ('hit', 'miss') AND p.notch = -2)::INT AS frosty_total,
    -- Chilled (notch = -1)
    COUNT(*) FILTER (WHERE p.result = 'hit' AND p.notch = -1)::INT AS chilled_hits,
    COUNT(*) FILTER (WHERE p.result IN ('hit', 'miss') AND p.notch = -1)::INT AS chilled_total,
    -- Heated (notch = 1)
    COUNT(*) FILTER (WHERE p.result = 'hit' AND p.notch = 1)::INT AS heated_hits,
    COUNT(*) FILTER (WHERE p.result IN ('hit', 'miss') AND p.notch = 1)::INT AS heated_total,
    -- Scorched (notch = 2)
    COUNT(*) FILTER (WHERE p.result = 'hit' AND p.notch = 2)::INT AS scorched_hits,
    COUNT(*) FILTER (WHERE p.result IN ('hit', 'miss') AND p.notch = 2)::INT AS scorched_total,
    -- Volcanic (notch = 3)
    COUNT(*) FILTER (WHERE p.result = 'hit' AND p.notch = 3)::INT AS volcanic_hits,
    COUNT(*) FILTER (WHERE p.result IN ('hit', 'miss') AND p.notch = 3)::INT AS volcanic_total,
    -- Has at least one wagered card
    BOOL_OR(c.fire_token_wager IS NOT NULL) AS has_wagered
  FROM cards c
  JOIN picks p ON p.card_id = c.id
  WHERE c.status = 'resolved'
    AND c.user_id IS NOT NULL
  GROUP BY c.user_id;
$$;
