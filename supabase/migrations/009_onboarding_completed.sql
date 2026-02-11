-- Add onboarding_completed flag to profiles
-- Used by the onboarding modal walkthrough to track first-time user completion
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
