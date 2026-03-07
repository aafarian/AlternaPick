-- 038: Enable email notifications for all users
-- Users should not have to opt into email notifications.
-- This sets all email_* preference keys to true for every profile
-- that has notification_preferences saved.

UPDATE profiles
SET notification_preferences = notification_preferences
  || '{"email_card_resolved": true, "email_challenge_received": true, "email_challenge_resolved": true, "email_friend_request": true}'::jsonb
WHERE notification_preferences IS NOT NULL;
