-- 027: Add icon_config column to profiles table
-- Stores user-customised icon configuration (jsonb, nullable).
-- NULL means "use random generation based on user ID" (default behaviour).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS icon_config jsonb DEFAULT NULL;
