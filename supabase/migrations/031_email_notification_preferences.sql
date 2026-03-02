-- Add email notification preference keys to notification_preferences JSONB
-- New keys: email_card_resolved, email_challenge_received,
--           email_challenge_resolved, email_friend_request
-- All default to true.

-- 1. Update the column DEFAULT to include the new email keys
ALTER TABLE profiles
  ALTER COLUMN notification_preferences
  SET DEFAULT '{
    "friend_request": true,
    "friend_accepted": true,
    "challenge_received": true,
    "challenge_accepted": true,
    "challenge_resolved": true,
    "card_resolved": true,
    "email_card_resolved": true,
    "email_challenge_received": true,
    "email_challenge_resolved": true,
    "email_friend_request": true
  }'::jsonb;

-- 2. Backfill existing rows that are missing any of the new keys (idempotent)
UPDATE profiles
SET notification_preferences = notification_preferences
  || jsonb_build_object(
       'email_card_resolved', true,
       'email_challenge_received', true,
       'email_challenge_resolved', true,
       'email_friend_request', true
     )
WHERE notification_preferences IS NOT NULL
  AND NOT (
    notification_preferences ? 'email_card_resolved'
    AND notification_preferences ? 'email_challenge_received'
    AND notification_preferences ? 'email_challenge_resolved'
    AND notification_preferences ? 'email_friend_request'
  );
