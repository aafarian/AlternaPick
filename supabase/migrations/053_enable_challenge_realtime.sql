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
