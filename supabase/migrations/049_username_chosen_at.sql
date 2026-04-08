-- Track whether the user has explicitly picked their own username, and stop
-- auto-populating display_name from Google's full_name on OAuth signup.
--
-- Two related bugs from AP-043:
--
-- 1. The OnboardingProvider used a regex (^user_[a-f0-9]{8}$) to detect
--    "auto-generated" usernames and fire the username setup modal. That regex
--    only matches the handle_new_user trigger fallback. OAuth signup paths
--    that put a value into raw_user_meta_data.username (or that copy a name
--    from raw_user_meta_data.full_name into display_name) produced rows that
--    don't match the regex, so the modal silently skipped and users got stuck
--    with random handles.
--
--    Fix: explicit `username_chosen_at TIMESTAMPTZ` column. NULL means
--    "never picked, prompt them"; non-NULL means "they have, leave alone".
--
-- 2. The handle_new_user trigger was copying Google's `full_name` into
--    `display_name` for OAuth signups. The UI then displayed `display_name`
--    in some surfaces (chips, popovers via the `display_name || username`
--    fallback) while showing `username` in others (settings page) — so a
--    single user could see two different "usernames" depending on where they
--    looked.
--
--    Fix: stop auto-populating display_name. New OAuth signups get NULL
--    display_name; the existing UI fallback `display_name || username`
--    therefore consistently shows the username for users who have not
--    explicitly chosen a display name.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username_chosen_at TIMESTAMPTZ;

-- Backfill: any existing row whose username does NOT match the auto-generated
-- pattern is assumed to have been chosen by the user (either via the signup
-- form or via the username modal in a previous session). Auto-pattern rows
-- stay NULL so the modal fires for them on next visit.
UPDATE profiles
SET username_chosen_at = COALESCE(updated_at, created_at, NOW())
WHERE username_chosen_at IS NULL
  AND username !~ '^user_[a-f0-9]{8}$';

-- Replace handle_new_user.
--
-- Verified safe: the only prior definition of this function is in
-- 001_initial_schema.sql, and it inserts only (id, username, display_name).
-- No subsequent migration adds columns to this trigger's INSERT. The
-- replacement below preserves all original columns and adds username_chosen_at.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, username_chosen_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::TEXT, 8)),
    -- Only honor an explicit display_name in user_metadata. Stop copying
    -- Google's full_name automatically — that's the source of the
    -- username/display_name UI mismatch. Users can set display_name
    -- explicitly via the profile editor.
    NEW.raw_user_meta_data->>'display_name',
    -- If the signup form passed a username explicitly, mark it chosen.
    -- Otherwise leave NULL so OnboardingProvider prompts the user.
    CASE
      WHEN NEW.raw_user_meta_data ? 'username' THEN NOW()
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace reset_profile_on_undelete to also reset the new column and clear
-- any stale display_name. Without this, a reactivated user would inherit
-- their old username_chosen_at timestamp from before deletion and skip the
-- onboarding modal even though their username has been reset to user_xxxxxxxx.
CREATE OR REPLACE FUNCTION reset_profile_on_undelete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE profiles
    SET
      username             = 'user_' || LEFT(NEW.id::TEXT, 8),
      display_name         = NULL,
      username_chosen_at   = NULL,
      onboarding_completed = false
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
