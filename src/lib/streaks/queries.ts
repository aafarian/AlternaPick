/**
 * Streak query layer.
 *
 * Reads daily-streak and freeze data for a user from
 * leaderboard_entries + profiles.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { typedFrom } from "@/lib/supabase/typed-queries";

export interface StreakInfo {
  daily_streak: number;
  best_daily_streak: number;
  last_played_date: string | null;
  freezes_available: number;
  next_freeze_reset: string | null;
}

/**
 * Fetch the current streak info for a given user.
 *
 * Combines data from leaderboard_entries (streak counters) and
 * profiles (freeze inventory). Returns sensible defaults when
 * no leaderboard entry exists yet.
 */
export async function getStreakInfo(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StreakInfo> {
  // Fetch leaderboard entry
  const { data: entry, error: entryErr } = await typedFrom(
    supabase,
    "leaderboard_entries"
  )
    .select("daily_streak, best_daily_streak, last_played_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (entryErr) throw new Error(entryErr.message);

  // Fetch profile freeze info
  const { data: profile, error: profileErr } = await typedFrom(
    supabase,
    "profiles"
  )
    .select("streak_freezes_available, last_streak_freeze_reset")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) throw new Error(profileErr.message);

  const typedEntry = entry as {
    daily_streak: number;
    best_daily_streak: number;
    last_played_date: string | null;
  } | null;

  const typedProfile = profile as {
    streak_freezes_available: number;
    last_streak_freeze_reset: string | null;
  } | null;

  // Compute next freeze reset: last_streak_freeze_reset + 7 days, or null
  let nextFreezeReset: string | null = null;
  if (typedProfile?.last_streak_freeze_reset) {
    const resetDate = new Date(typedProfile.last_streak_freeze_reset);
    resetDate.setUTCDate(resetDate.getUTCDate() + 7);
    nextFreezeReset = resetDate.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  return {
    daily_streak: typedEntry?.daily_streak ?? 0,
    best_daily_streak: typedEntry?.best_daily_streak ?? 0,
    last_played_date: typedEntry?.last_played_date ?? null,
    freezes_available: typedProfile?.streak_freezes_available ?? 0,
    next_freeze_reset: nextFreezeReset,
  };
}
