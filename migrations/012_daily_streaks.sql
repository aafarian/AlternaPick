-- Migration 012: Daily Streaks
-- Adds daily streak tracking columns to leaderboard_entries
-- and streak freeze columns to profiles.
--
-- Daily streak = consecutive days with at least 1 locked card.
-- Streak freezes: 1 per week for free users, auto-replenished.
-- last_played_date is DATE (not timestamp) for simple day comparison.
--
-- Run in Supabase SQL editor.

-- 1. Extend leaderboard_entries with daily streak columns
ALTER TABLE leaderboard_entries
  ADD COLUMN daily_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN best_daily_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN last_played_date DATE;

-- 2. Extend profiles with streak freeze columns
ALTER TABLE profiles
  ADD COLUMN streak_freezes_available INT NOT NULL DEFAULT 1,
  ADD COLUMN last_streak_freeze_reset DATE DEFAULT CURRENT_DATE;
