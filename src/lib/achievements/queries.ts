import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Achievement,
  UserAchievement,
} from "@/lib/supabase/types";
import { typedFrom } from "@/lib/supabase/typed-queries";

/**
 * Get all achievement definitions from the database.
 */
export async function getAllAchievements(
  supabase: SupabaseClient<Database>
): Promise<Achievement[]> {
  const { data, error } = await typedFrom(supabase, "achievements").select("*");

  if (error) {
    throw new Error(`Failed to fetch achievements: ${error.message}`);
  }

  return (data ?? []) as Achievement[];
}

/**
 * Get a single achievement definition by its unique key.
 */
export async function getAchievementByKey(
  supabase: SupabaseClient<Database>,
  key: string
): Promise<Achievement | null> {
  const { data, error } = await typedFrom(supabase, "achievements")
    .select("*")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch achievement by key: ${error.message}`);
  }

  return (data as Achievement) ?? null;
}

/**
 * Get all unlocked achievements for a user.
 * Returns user_achievement rows (including achievement_id and unlocked_at).
 */
export async function getUserAchievements(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserAchievement[]> {
  const { data, error } = await typedFrom(supabase, "user_achievements")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to fetch user achievements: ${error.message}`);
  }

  return (data ?? []) as UserAchievement[];
}

/**
 * Unlock an achievement for a user.
 * Inserts a row into user_achievements. The UNIQUE(user_id, achievement_id)
 * constraint prevents duplicates at the DB level.
 * Returns the inserted row, or null if it was a duplicate.
 */
export async function unlockAchievement(
  supabase: SupabaseClient<Database>,
  userId: string,
  achievementId: string
): Promise<UserAchievement | null> {
  const { data, error } = await typedFrom(supabase, "user_achievements")
    .insert({
      user_id: userId,
      achievement_id: achievementId,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation — achievement already unlocked
    if (error.code === "23505") {
      return null;
    }
    throw new Error(`Failed to unlock achievement: ${error.message}`);
  }

  return (data as UserAchievement) ?? null;
}
