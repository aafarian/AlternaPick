-- 028: Admin support - add is_admin and email columns to profiles
-- Part of admin-dashboard Phase 1: Foundation & Security

-- 1. Add columns
ALTER TABLE profiles
  ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN email TEXT;

-- 2. Backfill email from auth.users for existing profiles
UPDATE profiles
SET email = au.email
FROM auth.users au
WHERE profiles.id = au.id;

-- 3. Seed admin flag for the admin user
UPDATE profiles
SET is_admin = true
WHERE email = 'antoafarian@gmail.com';

-- 4. Trigger function to sync email from auth.users on new profile insert
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger on profiles insert
CREATE TRIGGER on_profile_insert_sync_email
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_profile_email();
