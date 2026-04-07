-- 048: Atomic admin claim of a guest challenge participant.
-- Wraps the participant + card + challenge updates in a single transaction
-- so a partial failure cannot leave the rows in an inconsistent state.

CREATE OR REPLACE FUNCTION admin_claim_guest_participant(
  p_participant_id uuid,
  p_target_user_id uuid,
  p_challenge_id   uuid,
  p_card_id        uuid,
  p_set_opponent   boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Link the participant row to the target user.
  UPDATE challenge_participants
     SET user_id = p_target_user_id
   WHERE id = p_participant_id
     AND user_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guest participant % not found or already claimed', p_participant_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Reassign the guest card if there is one.
  IF p_card_id IS NOT NULL THEN
    UPDATE cards
       SET user_id = p_target_user_id
     WHERE id = p_card_id
       AND user_id IS NULL;
  END IF;

  -- 3. For 1v1 challenges with a NULL opponent, set the opponent_id.
  IF p_set_opponent THEN
    UPDATE challenges
       SET opponent_id = p_target_user_id
     WHERE id = p_challenge_id
       AND opponent_id IS NULL;
  END IF;
END;
$$;

-- Only the service role should call this.
REVOKE ALL ON FUNCTION admin_claim_guest_participant(uuid, uuid, uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_claim_guest_participant(uuid, uuid, uuid, uuid, boolean) TO service_role;
