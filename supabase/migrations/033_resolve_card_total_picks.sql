-- Drop the old 3-param signature (from 019_resolve_card_atomic.sql) to avoid
-- ambiguous overload. PostgreSQL identifies functions by (name, arg types).
DROP FUNCTION IF EXISTS resolve_card(UUID, INT, JSONB);

CREATE OR REPLACE FUNCTION resolve_card(
  p_card_id UUID,
  p_score INT,
  p_total INT,
  p_picks JSONB
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
        actual_value = (v_pick->>'actual_value')::NUMERIC
    WHERE id = (v_pick->>'pick_id')::UUID;
  END LOOP;

  UPDATE cards
  SET status = 'resolved',
      score = p_score,
      total_picks = COALESCE(p_total, total_picks),
      resolved_at = NOW()
  WHERE id = p_card_id;

  RETURN TRUE;
END;
$$;
