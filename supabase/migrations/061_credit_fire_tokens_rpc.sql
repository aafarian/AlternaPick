-- Atomic fire token credit RPC.
-- Prevents lost writes from concurrent crediting (daily claim, challenge
-- bonuses, card resolution payouts) by using SET balance = balance + amount.

CREATE OR REPLACE FUNCTION credit_fire_tokens(
  p_user_id UUID,
  p_amount INT,
  p_include_lifetime BOOLEAN DEFAULT FALSE
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance INT;
BEGIN
  IF p_include_lifetime THEN
    UPDATE leaderboard_entries
    SET fire_tokens_balance = fire_tokens_balance + p_amount,
        fire_tokens_lifetime = fire_tokens_lifetime + p_amount
    WHERE user_id = p_user_id
    RETURNING fire_tokens_balance INTO v_new_balance;
  ELSE
    UPDATE leaderboard_entries
    SET fire_tokens_balance = fire_tokens_balance + p_amount
    WHERE user_id = p_user_id
    RETURNING fire_tokens_balance INTO v_new_balance;
  END IF;

  IF NOT FOUND THEN
    RETURN -1; -- row not found
  END IF;

  RETURN v_new_balance;
END;
$$;
