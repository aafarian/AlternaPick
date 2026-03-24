-- Allow group challenge participants to SELECT, UPDATE challenges they belong to.
-- The original RLS policies only check challenger_id / opponent_id, which excludes
-- group participants (opponent_id is NULL for group challenges).

-- SELECT: group participants can view their challenges
CREATE POLICY "challenges_select_group_participant" ON challenges FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM challenge_participants cp
    WHERE cp.challenge_id = challenges.id
      AND cp.user_id = auth.uid()
  )
);

-- UPDATE: group participants can update their challenges (e.g., status transitions)
CREATE POLICY "challenges_update_group_participant" ON challenges FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM challenge_participants cp
    WHERE cp.challenge_id = challenges.id
      AND cp.user_id = auth.uid()
  )
);
