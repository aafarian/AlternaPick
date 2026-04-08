-- Track whether the user has explicitly picked their own username.
--
-- The OnboardingProvider used to detect "auto-generated" usernames via a
-- regex (`^user_[a-f0-9]{8}$`) matching the trigger fallback. That worked
-- when the trigger was the only writer, but it broke for OAuth signups
-- whose username comes from elsewhere (e.g., Google identity metadata,
-- guest-conversion paths) — those usernames don't match the regex, so the
-- onboarding modal silently skipped and the user got stuck with whatever
-- random handle was assigned.
--
-- An explicit timestamp column is robust: NULL means "user has never picked
-- their own username, prompt them"; a value means "they have, leave them
-- alone".

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

-- Update the new-user trigger to NULL the column on insert (defensive — it
-- already defaults to NULL, but make it explicit so future trigger edits
-- don't accidentally set it).
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, username_chosen_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::TEXT, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name'),
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
