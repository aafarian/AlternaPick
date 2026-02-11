/**
 * Daily Streak Engine.
 *
 * Manages daily play-streak logic:
 *   - updateDailyStreak: called when a card is locked, increments/resets streak
 *   - resetWeeklyFreezes: replenishes streak freezes on a 7-day cadence
 *
 * All date comparisons use UTC calendar dates for consistency.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { typedFrom } from "@/lib/supabase/typed-queries";

/** UTC date string in YYYY-MM-DD format */
function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Compute the number of calendar days between two YYYY-MM-DD strings.
 * Returns a positive integer when `a` is after `b`.
 */
function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  const dateA = new Date(a + "T00:00:00Z");
  const dateB = new Date(b + "T00:00:00Z");
  return Math.round((dateA.getTime() - dateB.getTime()) / msPerDay);
}

export interface StreakUpdateResult {
  daily_streak: number;
  best_daily_streak: number;
  freeze_used: boolean;
}

/**
 * Update a user's daily streak when they lock a card.
 *
 * Logic:
 *  - Same day as last_played_date -> no-op (already counted today)
 *  - Exactly 1 day gap (yesterday) -> increment streak
 *  - Larger gap -> if freeze available, consume it and increment;
 *    otherwise reset streak to 1
 *  - Always update best_daily_streak = max(current, best)
 */
export async function updateDailyStreak(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StreakUpdateResult> {
  const today = utcToday();

  // 1. Fetch current leaderboard entry
  const { data: entry, error: entryErr } = await typedFrom(
    supabase,
    "leaderboard_entries"
  )
    .select("daily_streak, best_daily_streak, last_played_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (entryErr) throw new Error(entryErr.message);

  const typedEntry = entry as {
    daily_streak: number;
    best_daily_streak: number;
    last_played_date: string | null;
  } | null;

  let currentStreak = typedEntry?.daily_streak ?? 0;
  let bestStreak = typedEntry?.best_daily_streak ?? 0;
  const lastPlayed = typedEntry?.last_played_date ?? null;
  let freezeUsed = false;

  // 2. Determine action based on gap
  if (lastPlayed === today) {
    // Already played today - no-op
    return {
      daily_streak: currentStreak,
      best_daily_streak: bestStreak,
      freeze_used: false,
    };
  }

  if (lastPlayed && daysBetween(today, lastPlayed) === 1) {
    // Consecutive day - increment
    currentStreak += 1;
  } else if (lastPlayed && daysBetween(today, lastPlayed) > 1) {
    // Gap detected - check for freeze
    const { data: profile, error: profileErr } = await typedFrom(
      supabase,
      "profiles"
    )
      .select("streak_freezes_available")
      .eq("id", userId)
      .single();

    if (profileErr) throw new Error(profileErr.message);

    const typedProfile = profile as { streak_freezes_available: number };

    if (typedProfile.streak_freezes_available > 0) {
      // Use freeze: decrement freeze count, keep streak going
      freezeUsed = true;
      currentStreak += 1;

      const { error: freezeErr } = await typedFrom(supabase, "profiles")
        .update({
          streak_freezes_available: typedProfile.streak_freezes_available - 1,
        })
        .eq("id", userId);

      if (freezeErr) throw new Error(freezeErr.message);
    } else {
      // No freeze available - reset streak
      currentStreak = 1;
    }
  } else {
    // First time playing (lastPlayed is null)
    currentStreak = 1;
  }

  // 3. Update best streak
  bestStreak = Math.max(bestStreak, currentStreak);

  // 4. Persist to leaderboard_entries
  const { error: updateErr } = await typedFrom(
    supabase,
    "leaderboard_entries"
  )
    .update({
      daily_streak: currentStreak,
      best_daily_streak: bestStreak,
      last_played_date: today,
    })
    .eq("user_id", userId);

  if (updateErr) throw new Error(updateErr.message);

  return {
    daily_streak: currentStreak,
    best_daily_streak: bestStreak,
    freeze_used: freezeUsed,
  };
}

/**
 * Replenish streak freezes for users whose last reset was 7+ days ago
 * (or never reset).
 *
 * Sets streak_freezes_available = 1 and last_streak_freeze_reset = today
 * for all qualifying profiles.
 *
 * Intended to be called from the resolve/cron endpoint.
 */
export async function resetWeeklyFreezes(
  supabase: SupabaseClient<Database>
): Promise<{ updated_count: number }> {
  const today = utcToday();

  // Calculate the cutoff date (7 days ago)
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Update profiles where last_streak_freeze_reset is NULL
  const { data: nullResetData, error: nullErr } = await typedFrom(
    supabase,
    "profiles"
  )
    .update({
      streak_freezes_available: 1,
      last_streak_freeze_reset: today,
    })
    .is("last_streak_freeze_reset", null)
    .select("id");

  if (nullErr) throw new Error(nullErr.message);

  // Update profiles where last_streak_freeze_reset < cutoff
  const { data: oldResetData, error: oldErr } = await typedFrom(
    supabase,
    "profiles"
  )
    .update({
      streak_freezes_available: 1,
      last_streak_freeze_reset: today,
    })
    .lt("last_streak_freeze_reset", cutoffStr)
    .select("id");

  if (oldErr) throw new Error(oldErr.message);

  const nullCount = ((nullResetData ?? []) as Array<{ id: string }>).length;
  const oldCount = ((oldResetData ?? []) as Array<{ id: string }>).length;

  return { updated_count: nullCount + oldCount };
}
