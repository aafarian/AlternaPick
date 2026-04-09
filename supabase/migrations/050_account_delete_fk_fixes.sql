-- AP-046: Fix foreign keys that block hard-delete of an auth.users row.
--
-- The user-facing "Delete Account" button is being upgraded from a soft flag
-- (`profiles.is_deactivated = true`) to a real hard delete via
-- `supabase.auth.admin.deleteUser`. The hard delete relies on cascading FKs
-- from auth.users → profiles → all dependent tables.
--
-- A grep of every `REFERENCES profiles` and `REFERENCES auth.users` in the
-- migrations history found four FKs that have no `ON DELETE` action — they
-- default to `NO ACTION`, which blocks the parent delete. Without this
-- migration, hard delete will fail for any user who has ever:
--   - Won a 1v1 challenge (challenges.winner_id)
--   - Referred another user (profiles.referred_by, self-reference)
--   - Joined a group challenge (challenge_participants.user_id)
--   - Earned an achievement (user_achievements.user_id)
--
-- Plus one card-side FK that needs fixing too:
--   - challenge_participants.card_id (blocks card cascade-delete)
--
-- Action chosen per FK:
--   - `winner_id` → SET NULL (preserve historical record of the challenge,
--     just clear the winner attribution)
--   - `referred_by` → SET NULL (preserve referral chain integrity for others;
--     deleted user simply has no back-reference)
--   - `challenge_participants.user_id` → CASCADE (the participant row is
--     bound to a specific user; if the user is gone, the row should go too)
--   - `challenge_participants.card_id` → SET NULL (the participant row may
--     outlive the card if cascade-deleted from the user side)
--   - `user_achievements.user_id` → CASCADE (achievements are personal data,
--     they go with the user)

-- challenges.winner_id → SET NULL
ALTER TABLE challenges
  DROP CONSTRAINT IF EXISTS challenges_winner_id_fkey;
ALTER TABLE challenges
  ADD CONSTRAINT challenges_winner_id_fkey
  FOREIGN KEY (winner_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- profiles.referred_by → SET NULL (self-referencing FK)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_referred_by_fkey;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_referred_by_fkey
  FOREIGN KEY (referred_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- challenge_participants.user_id → CASCADE
ALTER TABLE challenge_participants
  DROP CONSTRAINT IF EXISTS challenge_participants_user_id_fkey;
ALTER TABLE challenge_participants
  ADD CONSTRAINT challenge_participants_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- challenge_participants.card_id → SET NULL
ALTER TABLE challenge_participants
  DROP CONSTRAINT IF EXISTS challenge_participants_card_id_fkey;
ALTER TABLE challenge_participants
  ADD CONSTRAINT challenge_participants_card_id_fkey
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE SET NULL;

-- user_achievements.user_id → CASCADE
ALTER TABLE user_achievements
  DROP CONSTRAINT IF EXISTS user_achievements_user_id_fkey;
ALTER TABLE user_achievements
  ADD CONSTRAINT user_achievements_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
