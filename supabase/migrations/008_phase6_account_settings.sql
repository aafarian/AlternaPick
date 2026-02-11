-- Phase 6: Account settings columns on profiles
-- Adds notification_preferences (JSONB) and is_deactivated (boolean) for settings page

-- 1. Notification preferences: JSON object keyed by notification type with boolean values
--    Default: all notifications enabled
ALTER TABLE profiles
  ADD COLUMN notification_preferences JSONB DEFAULT '{
    "friend_request": true,
    "friend_accepted": true,
    "challenge_received": true,
    "challenge_accepted": true,
    "challenge_resolved": true,
    "card_resolved": true
  }'::jsonb;

-- 2. Soft-delete / deactivation flag
ALTER TABLE profiles
  ADD COLUMN is_deactivated BOOLEAN NOT NULL DEFAULT false;
