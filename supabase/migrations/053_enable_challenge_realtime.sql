-- Enable Supabase Realtime on the challenge-related tables so client-side
-- subscriptions (useParticipantsRealtime, useChallengesRealtime, and the new
-- useChallengeDetailRealtime) actually receive postgres_changes events.
--
-- Previously only `notifications` was published (migration 015). The hooks
-- for challenges, cards, and challenge_participants connected successfully
-- but silently delivered zero events because the tables weren't in the
-- publication.
--
-- This single migration fixes three hooks at once:
--   1. useChallengesRealtime  (challenges list page — already wired, never worked)
--   2. useParticipantsRealtime (group lobby — already wired, never worked)
--   3. useChallengeDetailRealtime (1v1 challenge detail — new in this PR)

ALTER PUBLICATION supabase_realtime ADD TABLE challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE cards;
ALTER PUBLICATION supabase_realtime ADD TABLE challenge_participants;

-- The existing cards RLS policy (cards_select_own from migration 003) only
-- allows auth.uid() = user_id. Supabase Realtime applies the same RLS check
-- when delivering postgres_changes events. Without this policy, a challenger
-- subscribing to card INSERT/UPDATE on a challenge will never receive events
-- for the opponent's card — Realtime silently drops them.
--
-- This policy lets challenge participants SELECT each other's cards on the
-- same challenge. It's additive — it doesn't remove the existing own-card
-- policy, just extends visibility to cards on shared challenges.
CREATE POLICY "cards_select_challenge_participant" ON cards FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM challenges
    WHERE challenges.id = cards.challenge_id
      AND (challenges.challenger_id = auth.uid() OR challenges.opponent_id = auth.uid())
  )
);
