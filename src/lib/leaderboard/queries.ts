import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { typedFrom } from "@/lib/supabase/typed-queries";

export interface LeaderboardRow {
  id: string;
  user_id: string;
  total_cards: number;
  total_correct_picks: number;
  win_rate: number;
  current_streak: number;
  best_streak: number;
  h2h_wins: number;
  h2h_losses: number;
  updated_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface UserRank {
  rank: number;
  entry: LeaderboardRow;
}

/** Shape a raw Supabase row into a LeaderboardRow */
function toLeaderboardRow(row: Record<string, unknown>): LeaderboardRow {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    total_cards: row.total_cards as number,
    total_correct_picks: row.total_correct_picks as number,
    win_rate: row.win_rate as number,
    current_streak: row.current_streak as number,
    best_streak: row.best_streak as number,
    h2h_wins: row.h2h_wins as number,
    h2h_losses: row.h2h_losses as number,
    updated_at: row.updated_at as string,
    profile: row.profiles as LeaderboardRow["profile"],
  };
}

/**
 * Get the global leaderboard, ordered by win_rate desc with tiebreakers
 * on total_correct_picks desc, then best_streak desc.
 */
export async function getGlobalLeaderboard(
  supabase: SupabaseClient<Database>,
  limit: number = 25,
  offset: number = 0
): Promise<LeaderboardRow[]> {
  const { data, error } = await typedFrom(supabase, "leaderboard_entries")
    .select(
      "*, profiles!leaderboard_entries_user_id_fkey(id, username, display_name, avatar_url)"
    )
    .order("win_rate", { ascending: false })
    .order("total_correct_picks", { ascending: false })
    .order("best_streak", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map(toLeaderboardRow);
}

/**
 * Get the friends leaderboard for a user: includes only the user
 * themselves and their accepted friends, sorted by win_rate desc
 * with tiebreakers.
 */
export async function getFriendsLeaderboard(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number = 25,
  offset: number = 0
): Promise<LeaderboardRow[]> {
  // Step 1: Get accepted friend IDs (same pattern as activity route)
  const { data: asRequester, error: err1 } = await typedFrom(
    supabase,
    "friendships"
  )
    .select("addressee_id")
    .eq("requester_id", userId)
    .eq("status", "accepted");

  if (err1) throw new Error(err1.message);

  const { data: asAddressee, error: err2 } = await typedFrom(
    supabase,
    "friendships"
  )
    .select("requester_id")
    .eq("addressee_id", userId)
    .eq("status", "accepted");

  if (err2) throw new Error(err2.message);

  const friendIds = new Set<string>();
  for (const row of (asRequester ?? []) as Array<{ addressee_id: string }>) {
    friendIds.add(row.addressee_id);
  }
  for (const row of (asAddressee ?? []) as Array<{ requester_id: string }>) {
    friendIds.add(row.requester_id);
  }

  // Always include self
  friendIds.add(userId);

  const userIds = Array.from(friendIds);

  // Step 2: Fetch leaderboard entries for these users with profile join
  const { data, error } = await typedFrom(supabase, "leaderboard_entries")
    .select(
      "*, profiles!leaderboard_entries_user_id_fkey(id, username, display_name, avatar_url)"
    )
    .in("user_id", userIds)
    .order("win_rate", { ascending: false })
    .order("total_correct_picks", { ascending: false })
    .order("best_streak", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map(toLeaderboardRow);
}

/**
 * Get a user's global rank and stats.
 * Rank is determined by the number of users with a strictly higher win_rate,
 * plus those with the same win_rate but higher total_correct_picks,
 * plus those with the same win_rate and total_correct_picks but higher best_streak.
 */
export async function getUserRank(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UserRank | null> {
  // Step 1: Get the user's leaderboard entry with profile
  const { data: entryData, error: entryError } = await typedFrom(
    supabase,
    "leaderboard_entries"
  )
    .select(
      "*, profiles!leaderboard_entries_user_id_fkey(id, username, display_name, avatar_url)"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (entryError) throw new Error(entryError.message);

  if (!entryData) return null;

  const entry = toLeaderboardRow(entryData as Record<string, unknown>);

  // Step 2: Count users with strictly higher win_rate
  const { count: higherWinRate, error: countErr1 } = await typedFrom(
    supabase,
    "leaderboard_entries"
  )
    .select("id", { count: "exact", head: true })
    .gt("win_rate", entry.win_rate);

  if (countErr1) throw new Error(countErr1.message);

  // Step 3: Count users with same win_rate but more total_correct_picks
  const { count: samWrHigherPicks, error: countErr2 } = await typedFrom(
    supabase,
    "leaderboard_entries"
  )
    .select("id", { count: "exact", head: true })
    .eq("win_rate", entry.win_rate)
    .gt("total_correct_picks", entry.total_correct_picks);

  if (countErr2) throw new Error(countErr2.message);

  // Step 4: Count users with same win_rate, same total_correct_picks, but higher best_streak
  const { count: samWrSamePicksHigherStreak, error: countErr3 } =
    await typedFrom(supabase, "leaderboard_entries")
      .select("id", { count: "exact", head: true })
      .eq("win_rate", entry.win_rate)
      .eq("total_correct_picks", entry.total_correct_picks)
      .gt("best_streak", entry.best_streak);

  if (countErr3) throw new Error(countErr3.message);

  const rank =
    (higherWinRate ?? 0) +
    (samWrHigherPicks ?? 0) +
    (samWrSamePicksHigherStreak ?? 0) +
    1;

  return { rank, entry };
}
