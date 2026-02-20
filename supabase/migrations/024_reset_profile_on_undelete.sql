-- Reset profile when a soft-deleted user is reactivated (deleted_at → null).
-- Supabase dashboard "delete user" is a soft delete; re-signup with the same
-- OAuth provider reactivates the row. Without this trigger the old profile
-- (custom username, onboarding_completed = true) would persist and the
-- onboarding modals would never show again.

CREATE OR REPLACE FUNCTION reset_profile_on_undelete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE profiles
    SET
      username            = 'user_' || LEFT(NEW.id::TEXT, 8),
      onboarding_completed = false
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_undeleted
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION reset_profile_on_undelete();
