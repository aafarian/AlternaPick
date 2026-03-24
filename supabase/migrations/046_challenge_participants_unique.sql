-- Prevent duplicate participant rows for the same user or email in a challenge.
-- Guards against concurrent requests creating duplicates.

-- User-based participants: one row per (challenge, user)
CREATE UNIQUE INDEX IF NOT EXISTS challenge_participants_challenge_user_unique
  ON challenge_participants (challenge_id, user_id)
  WHERE user_id IS NOT NULL;

-- Email-based participants (guests): one row per (challenge, email)
CREATE UNIQUE INDEX IF NOT EXISTS challenge_participants_challenge_email_unique
  ON challenge_participants (challenge_id, email)
  WHERE email IS NOT NULL;
