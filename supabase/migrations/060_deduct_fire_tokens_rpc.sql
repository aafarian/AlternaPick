-- Atomic fire token deduction RPC.
-- Prevents double-spend from concurrent wager requests by using
-- SET balance = balance - p_wager (SQL expression) instead of
-- a pre-computed value from a prior SELECT.

CREATE OR REPLACE FUNCTION deduct_fire_tokens(
  p_user_id UUID,
  p_wager INT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance INT;
BEGIN
  UPDATE leaderboard_entries
  SET fire_tokens_balance = fire_tokens_balance - p_wager
  WHERE user_id = p_user_id
    AND fire_tokens_balance >= p_wager
  RETURNING fire_tokens_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN -1; -- insufficient balance or row not found
  END IF;

  RETURN v_new_balance;
END;
$$;
