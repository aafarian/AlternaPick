-- Fix type mismatch in claim_daily_tokens: cast p_today text to date
-- for comparison with fire_tokens_last_claim (date column).

CREATE OR REPLACE FUNCTION claim_daily_tokens(
  p_user_id UUID,
  p_amount INT,
  p_today TEXT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance INT;
BEGIN
  UPDATE leaderboard_entries
  SET fire_tokens_balance = fire_tokens_balance + p_amount,
      fire_tokens_last_claim = p_today::DATE
  WHERE user_id = p_user_id
    AND (fire_tokens_last_claim IS NULL OR fire_tokens_last_claim <> p_today::DATE)
  RETURNING fire_tokens_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN -1; -- already claimed today or row not found
  END IF;

  RETURN v_new_balance;
END;
$$;
