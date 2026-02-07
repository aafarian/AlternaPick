-- Phase 4: Social RLS Policy Additions for Friends & Challenges
-- Adds DELETE policies and bidirectional friendship duplicate prevention

-- ============================================================
-- 1. DELETE POLICY: friendships
-- Either participant can delete (unfriend / decline request)
-- ============================================================

CREATE POLICY "friendships_delete_participant" ON friendships
  FOR DELETE USING (
    auth.uid() = requester_id OR auth.uid() = addressee_id
  );

-- ============================================================
-- 2. DELETE POLICY: challenges
-- Challenger can cancel a pending challenge; either participant
-- can delete (cleanup resolved/declined challenges)
-- ============================================================

CREATE POLICY "challenges_delete_participant" ON challenges
  FOR DELETE USING (
    auth.uid() = challenger_id OR auth.uid() = opponent_id
  );

-- ============================================================
-- 3. BIDIRECTIONAL FRIENDSHIP DUPLICATE PREVENTION
-- Prevents inserting A->B when B->A already exists.
-- The existing UNIQUE(requester_id, addressee_id) only prevents
-- exact duplicates; this trigger catches the reverse direction.
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_bidirectional_friendship()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if a friendship already exists in the reverse direction
  IF EXISTS (
    SELECT 1 FROM friendships
    WHERE requester_id = NEW.addressee_id
      AND addressee_id = NEW.requester_id
  ) THEN
    RAISE EXCEPTION 'A friendship between these users already exists'
      USING ERRCODE = 'unique_violation';
  END IF;

  -- Prevent self-friendship
  IF NEW.requester_id = NEW.addressee_id THEN
    RAISE EXCEPTION 'Cannot create a friendship with yourself'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_bidirectional_friendship
  BEFORE INSERT ON friendships
  FOR EACH ROW EXECUTE FUNCTION prevent_bidirectional_friendship();
