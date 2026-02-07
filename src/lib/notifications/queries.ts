import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface UnreadCounts {
  pendingFriendRequests: number;
  pendingChallenges: number;
}

/**
 * Get unread notification counts for a user.
 * - pendingFriendRequests: friendships where addressee_id = userId AND status = 'pending'
 * - pendingChallenges: challenges where opponent_id = userId AND status = 'pending'
 */
export async function getUnreadCounts(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UnreadCounts> {
  // Count pending friend requests received by the user
  const { count: friendCount, error: friendError } = await (
    supabase.from("friendships") as any
  )
    .select("id", { count: "exact", head: true })
    .eq("addressee_id", userId)
    .eq("status", "pending");

  if (friendError) {
    throw new Error(
      `Failed to count pending friend requests: ${friendError.message}`
    );
  }

  // Count pending challenges received by the user
  const { count: challengeCount, error: challengeError } = await (
    supabase.from("challenges") as any
  )
    .select("id", { count: "exact", head: true })
    .eq("opponent_id", userId)
    .eq("status", "pending");

  if (challengeError) {
    throw new Error(
      `Failed to count pending challenges: ${challengeError.message}`
    );
  }

  return {
    pendingFriendRequests: friendCount ?? 0,
    pendingChallenges: challengeCount ?? 0,
  };
}
