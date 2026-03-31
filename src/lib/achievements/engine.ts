import { logError } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Achievement, NotificationPreferences } from "@/lib/supabase/types";
import { ACHIEVEMENT_CHECKS, type AchievementContext } from "./definitions";
import {
  getAllAchievements,
  getUserAchievements,
  unlockAchievement,
} from "./queries";
import { createNotification } from "@/lib/notifications/queries";

export interface UnlockedAchievement {
  key: string;
  name: string;
  icon: string;
}

/**
 * Checks all achievement definitions against the given context and
 * unlocks any newly-earned badges. Creates a notification for each
 * new unlock.
 *
 * This function is designed to be called fire-and-forget from
 * resolution flows. Errors are caught and logged — they must
 * never break the calling flow.
 *
 * @returns Array of newly unlocked achievements (empty if none).
 */
export async function checkAndUnlockAchievements(
  supabase: SupabaseClient<Database>,
  userId: string,
  context: AchievementContext
): Promise<UnlockedAchievement[]> {
  try {
    // 1. Fetch all achievement definitions, user's existing unlocks, and preferences in parallel
    const [allAchievements, userAchievements, { data: userProfile }] = await Promise.all([
      getAllAchievements(supabase),
      getUserAchievements(supabase, userId),
      (supabase.from("profiles") as any)
        .select("notification_preferences")
        .eq("id", userId)
        .single() as Promise<{
        data: { notification_preferences: NotificationPreferences | null } | null;
      }>,
    ]);
    const userPrefs = userProfile?.notification_preferences ?? null;

    // 2. Build a set of already-unlocked achievement IDs for fast lookup
    const unlockedIds = new Set(
      userAchievements.map((ua) => ua.achievement_id)
    );

    // 3. Build a map of key -> Achievement for quick lookup
    const achievementsByKey = new Map<string, Achievement>();
    for (const a of allAchievements) {
      achievementsByKey.set(a.key, a);
    }

    // 4. Check each definition and collect newly eligible achievements
    const newlyUnlocked: UnlockedAchievement[] = [];

    for (const [key, checkFn] of Object.entries(ACHIEVEMENT_CHECKS)) {
      const achievement = achievementsByKey.get(key);
      if (!achievement) continue; // definition exists in code but not DB — skip
      if (unlockedIds.has(achievement.id)) continue; // already unlocked

      let passed = false;
      try {
        passed = checkFn(context);
      } catch (checkErr) {
        logError("achievement-engine", `Achievement check "${key}" threw an error`, undefined, checkErr);
        continue;
      }

      if (!passed) continue;

      // 5. Unlock the achievement (DB unique constraint prevents duplicates)
      const unlocked = await unlockAchievement(
        supabase,
        userId,
        achievement.id
      );

      if (!unlocked) continue; // was a duplicate (race condition)

      newlyUnlocked.push({
        key: achievement.key,
        name: achievement.name,
        icon: achievement.icon,
      });

      // 6. Create a notification for the new unlock (fire-and-forget within fire-and-forget)
      try {
        await createNotification(supabase, {
          user_id: userId,
          type: "achievement_unlocked",
          title: `Badge Unlocked: ${achievement.name}`,
          body: achievement.description,
          metadata: {
            achievement_id: achievement.id,
            achievement_key: achievement.key,
            icon: achievement.icon,
          },
        }, userPrefs);
      } catch (notifErr) {
        logError(
          "achievement-engine",
          `Failed to create notification for achievement "${key}"`,
          undefined,
          notifErr
        );
      }
    }

    return newlyUnlocked;
  } catch (err) {
    // Top-level catch: achievement failures must NEVER break the caller
    logError("achievement-engine", "Achievement engine error", undefined, err);
    return [];
  }
}
