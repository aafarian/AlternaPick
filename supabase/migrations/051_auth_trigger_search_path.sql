-- Fix: triggers fired by `supabase_auth_admin` were failing with
-- `relation "profiles" does not exist` because the trigger functions
-- referenced `profiles` (and `leaderboard_entries`) without schema
-- qualification. The `supabase_auth_admin` role's `search_path` does not
-- include `public`, so Postgres couldn't resolve the unqualified names.
--
-- This broke any new user signup with the generic GoTrue message
-- "Database error saving new user".
--
-- Fix: pin `search_path = public, pg_temp` on every function that's invoked
-- from an `auth.users` trigger, AND fully qualify the table references as
-- `public.<table>` so we're protected even if the search_path setting is
-- ever stripped. Belt and suspenders.
--
-- Affected functions:
--   - handle_new_user            (fired on auth.users INSERT)
--   - handle_new_profile         (chain-fired when handle_new_user inserts a profile)
--   - reset_profile_on_undelete  (fired on auth.users UPDATE for soft-delete reactivation)
--
-- The function bodies are otherwise identical to migration 049 (and 001 for
-- handle_new_profile). This migration is purely a correctness fix for the
-- search_path issue — no behavior changes.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, username_chosen_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::TEXT, 8)),
    NEW.raw_user_meta_data->>'display_name',
    CASE
      WHEN NEW.raw_user_meta_data ? 'username' THEN NOW()
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.leaderboard_entries (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION reset_profile_on_undelete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE public.profiles
    SET
      username             = 'user_' || LEFT(NEW.id::TEXT, 8),
      display_name         = NULL,
      username_chosen_at   = NULL,
      onboarding_completed = false
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Same anti-pattern (SECURITY DEFINER without SET search_path) exists in
-- sync_profile_email from migration 028. It's not currently broken because
-- the function qualifies `auth.users`, but it runs as part of the same
-- new-user trigger chain and is the next latent bug waiting to bite. Pin
-- it the same way for consistency.
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  RETURN NEW;
END;
$$;
