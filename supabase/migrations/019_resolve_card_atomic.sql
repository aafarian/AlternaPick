-- Atomic card resolution: updates all picks + card status in a single transaction.
-- Only succeeds if the card is currently in 'locked' status, preventing race
-- conditions between tryResolveFromLiveData and the scheduled resolver.

CREATE OR REPLACE FUNCTION resolve_card(
  p_card_id UUID,
  p_score INT,
  p_picks JSONB -- array of { pick_id, result, actual_value }
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_card_status TEXT;
  v_pick JSONB;
BEGIN
  -- Lock the card row and verify status
  SELECT status INTO v_card_status
  FROM cards
  WHERE id = p_card_id
  FOR UPDATE;

  IF v_card_status IS NULL THEN
    RAISE EXCEPTION 'Card not found: %', p_card_id;
  END IF;

  IF v_card_status <> 'locked' THEN
    RETURN FALSE; -- Already resolved (race condition) — caller should handle gracefully
  END IF;

  -- Update each pick
  FOR v_pick IN SELECT * FROM jsonb_array_elements(p_picks)
  LOOP
    UPDATE picks
    SET result = (v_pick->>'result')::TEXT,
        actual_value = (v_pick->>'actual_value')::NUMERIC
    WHERE id = (v_pick->>'pick_id')::UUID;
  END LOOP;

  -- Update card status atomically
  UPDATE cards
  SET status = 'resolved',
      score = p_score,
      resolved_at = NOW()
  WHERE id = p_card_id;

  RETURN TRUE;
END;
$$;
