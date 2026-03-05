import { logError } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { typedFrom } from "@/lib/supabase/typed-queries";
import { checkAndUnlockAchievements } from "@/lib/achievements/engine";
import type { ReferralInfo, ReferralStats, ReferredUser } from "./types";

/**
 * Get referral info for a user: their referral link and how many
 * users they have referred.
 *
 * Referral link format: /join/[username]
 */
export async function getReferralInfo(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ReferralInfo> {
  // 1. Get the user's username
  const { data: profile, error: profileError } = await typedFrom(
    supabase,
    "profiles"
  )
    .select("username")
    .eq("id", userId)
    .single();

  if (profileError) {
    throw new Error(`Failed to fetch profile: ${profileError.message}`);
  }

  const username = (profile as { username: string }).username;

  // 2. Count how many profiles have referred_by = this userId
  const { count, error: countError } = await typedFrom(supabase, "profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", userId);

  if (countError) {
    throw new Error(`Failed to count referrals: ${countError.message}`);
  }

  const totalReferred = count ?? 0;

  return {
    referralLink: `/join/${username}`,
    totalReferred,
    // Each referral earns 1 streak freeze
    rewardsEarned: totalReferred,
  };
}

/**
 * Process a referral: link the new user to their referrer, create an
 * accepted friendship, award a streak freeze, and trigger an achievement
 * check for the "Recruiter" badge.
 *
 * This function is idempotent: if the new user already has a referred_by
 * value set, it is a no-op.
 *
 * @param supabase - Supabase client
 * @param newUserId - The ID of the newly signed-up user
 * @param referrerUsername - The username from the /join/[username] link
 */
export async function processReferral(
  supabase: SupabaseClient<Database>,
  newUserId: string,
  referrerUsername: string
): Promise<void> {
  // 1. Look up the referrer by username
  const { data: referrerData, error: referrerError } = await typedFrom(
    supabase,
    "profiles"
  )
    .select("id")
    .eq("username", referrerUsername)
    .maybeSingle();

  if (referrerError) {
    throw new Error(
      `Failed to look up referrer: ${referrerError.message}`
    );
  }

  if (!referrerData) {
    throw new Error(`Referrer "${referrerUsername}" not found`);
  }

  const referrerId = (referrerData as { id: string }).id;

  // Prevent self-referral
  if (referrerId === newUserId) {
    return;
  }

  // 2. Check that the new user's referred_by is null (idempotent guard)
  const { data: newUserData, error: newUserError } = await typedFrom(
    supabase,
    "profiles"
  )
    .select("referred_by")
    .eq("id", newUserId)
    .single();

  if (newUserError) {
    throw new Error(
      `Failed to fetch new user profile: ${newUserError.message}`
    );
  }

  const newUser = newUserData as { referred_by: string | null };

  if (newUser.referred_by !== null) {
    // Already referred — no-op for idempotency
    return;
  }

  // 3. Set referred_by on the new user's profile
  const { error: updateError } = await typedFrom(supabase, "profiles")
    .update({ referred_by: referrerId })
    .eq("id", newUserId);

  if (updateError) {
    throw new Error(
      `Failed to set referred_by: ${updateError.message}`
    );
  }

  // 4. Create an accepted friendship between referrer and referee
  //    The unique constraint on friendships prevents duplicate inserts.
  const { error: friendshipError } = await typedFrom(
    supabase,
    "friendships"
  ).insert({
    requester_id: referrerId,
    addressee_id: newUserId,
    status: "accepted",
  });

  if (friendshipError) {
    // 23505 = unique_violation — friendship already exists
    if (friendshipError.code !== "23505") {
      throw new Error(
        `Failed to create friendship: ${friendshipError.message}`
      );
    }
  }

  // 5. Increment referrer's streak_freezes_available by 1
  //    Fetch current value, then update to avoid race conditions with rpc.
  const { data: referrerProfile, error: freezeReadError } = await typedFrom(
    supabase,
    "profiles"
  )
    .select("streak_freezes_available")
    .eq("id", referrerId)
    .single();

  if (freezeReadError) {
    throw new Error(
      `Failed to read referrer freeze count: ${freezeReadError.message}`
    );
  }

  const currentFreezes = (
    referrerProfile as { streak_freezes_available: number }
  ).streak_freezes_available;

  const { error: freezeUpdateError } = await typedFrom(supabase, "profiles")
    .update({ streak_freezes_available: currentFreezes + 1 })
    .eq("id", referrerId)
    .eq("streak_freezes_available", currentFreezes); // optimistic lock

  if (freezeUpdateError) {
    logError(
      "referrals",
      `Failed to increment streak freeze for referrer ${referrerId}: ${freezeUpdateError.message}`
    );
    // Non-fatal: the referral itself succeeded
  }

  // 6. Fire-and-forget achievement check for "Recruiter" badge
  //    Count total referrals for the leaderboard context
  const { count: totalReferred } = await typedFrom(supabase, "profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", referrerId);

  // Fetch leaderboard stats for the referrer (needed by achievement engine)
  const { data: lbData } = await typedFrom(supabase, "leaderboard_entries")
    .select(
      "total_cards, current_streak, best_streak, win_rate, h2h_wins, h2h_losses"
    )
    .eq("user_id", referrerId)
    .maybeSingle();

  const leaderboardStats = lbData
    ? (lbData as {
        total_cards: number;
        current_streak: number;
        best_streak: number;
        win_rate: number;
        h2h_wins: number;
        h2h_losses: number;
      })
    : {
        total_cards: 0,
        current_streak: 0,
        best_streak: 0,
        win_rate: 0,
        h2h_wins: 0,
        h2h_losses: 0,
      };

  // Fire-and-forget: do not await, but catch errors
  checkAndUnlockAchievements(supabase, referrerId, {
    leaderboardStats,
    friendCount: totalReferred ?? 0,
  }).catch((err) => {
    logError("referrals", "Referral achievement check failed", undefined, err);
  });
}

/**
 * Get detailed referral statistics for a user, including a list of
 * all users they have referred.
 */
export async function getReferralStats(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ReferralStats> {
  const { data, error } = await typedFrom(supabase, "profiles")
    .select("username, created_at")
    .eq("referred_by", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch referral stats: ${error.message}`);
  }

  const referredUsers = ((data ?? []) as ReferredUser[]).map((u) => ({
    username: u.username,
    created_at: u.created_at,
  }));

  return {
    totalReferred: referredUsers.length,
    referredUsers,
  };
}
