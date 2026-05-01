-- Extend resolve_card RPC to persist Fire Token payout.
--
-- Adds optional p_fire_token_payout parameter. When non-null, sets
-- cards.fire_token_payout on resolution. Backward compatible.

-- Drop old 5-param signature to avoid ambiguous overload
DROP FUNCTION IF EXISTS resolve_card(UUID, INT, INT, JSONB, INT);

CREATE OR REPLACE FUNCTION resolve_card(
  p_card_id UUID,
  p_score INT,
  p_total INT,
  p_picks JSONB,
  p_heat_score INT DEFAULT NULL,
  p_fire_token_payout INT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_card_status TEXT;
  v_pick JSONB;
BEGIN
  SELECT status INTO v_card_status
  FROM cards
  WHERE id = p_card_id
  FOR UPDATE;

  IF v_card_status IS NULL THEN
    RAISE EXCEPTION 'Card not found: %', p_card_id;
  END IF;

  IF v_card_status <> 'locked' THEN
    RETURN FALSE;
  END IF;

  FOR v_pick IN SELECT * FROM jsonb_array_elements(p_picks)
  LOOP
    UPDATE picks
    SET result = (v_pick->>'result')::pick_result,
        actual_value = (v_pick->>'actual_value')::NUMERIC,
        heat_score = (v_pick->>'heat_score')::INTEGER
    WHERE id = (v_pick->>'pick_id')::UUID;
  END LOOP;

  UPDATE cards
  SET status = 'resolved',
      score = p_score,
      total_picks = COALESCE(p_total, total_picks),
      heat_score = COALESCE(p_heat_score, heat_score),
      fire_token_payout = COALESCE(p_fire_token_payout, fire_token_payout),
      resolved_at = NOW()
  WHERE id = p_card_id;

  RETURN TRUE;
END;
$$;
