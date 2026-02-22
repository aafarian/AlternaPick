import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/typed-queries";
import { getFriendIds } from "@/lib/friends/get-friend-ids";

export type LeaderboardSort = "hit_rate" | "h2h";

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
  h2h_win_pct: number;
  updated_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    icon_config: Record<string, unknown> | null;
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
    h2h_win_pct: row.h2h_win_pct as number,
    updated_at: row.updated_at as string,
    profile: row.profiles as LeaderboardRow["profile"],
  };
}

/** Apply sort ordering to a query builder */
function applySortOrder<T extends { order: (...args: any[]) => T }>(
  query: T,
  sort: LeaderboardSort
): T {
  if (sort === "h2h") {
    return query
      .order("h2h_win_pct", { ascending: false })
      .order("h2h_wins", { ascending: false })
      .order("win_rate", { ascending: false });
  }
  return query
    .order("win_rate", { ascending: false })
    .order("total_correct_picks", { ascending: false })
    .order("total_cards", { ascending: false });
}

/**
 * Get the global leaderboard, ordered by the given sort criteria.
 * Uses a 5-minute cache to avoid heavy table scans on every pageview.
 */
export async function getGlobalLeaderboard(
  _supabase: SupabaseClient<Database>,
  limit: number = 25,
  offset: number = 0,
  sort: LeaderboardSort = "hit_rate"
): Promise<LeaderboardRow[]> {
  return getCachedGlobalLeaderboard(limit, offset, sort);
}

async function getGlobalLeaderboardInternal(
  limit: number,
  offset: number,
  sort: LeaderboardSort
): Promise<LeaderboardRow[]> {
  const supabase = createAdminClient();
  const query = typedFrom(supabase, "leaderboard_entries").select(
    "*, profiles!leaderboard_entries_user_id_fkey(id, username, display_name, avatar_url, icon_config)"
  );

  const { data, error } = await applySortOrder(query, sort).range(
    offset,
    offset + limit - 1
  );

  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map(toLeaderboardRow);
}

const getCachedGlobalLeaderboard = unstable_cache(
  getGlobalLeaderboardInternal,
  ["global-leaderboard"],
  { revalidate: 300 }
);

/**
 * Get the friends leaderboard for a user: includes only the user
 * themselves and their accepted friends, sorted by win_rate desc
 * with tiebreakers.
 */
export async function getFriendsLeaderboard(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number = 25,
  offset: number = 0,
  sort: LeaderboardSort = "hit_rate"
): Promise<LeaderboardRow[]> {
  const friendIdList = await getFriendIds(supabase, userId);
  const userIds = [...friendIdList, userId]; // Always include self

  // Step 2: Fetch leaderboard entries for these users with profile join
  const query = typedFrom(supabase, "leaderboard_entries")
    .select(
      "*, profiles!leaderboard_entries_user_id_fkey(id, username, display_name, avatar_url, icon_config)"
    )
    .in("user_id", userIds);

  const { data, error } = await applySortOrder(query, sort).range(
    offset,
    offset + limit - 1
  );

  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map(toLeaderboardRow);
}

/**
 * Get a user's global rank and stats.
 * Rank is computed via a single Postgres function using ROW_NUMBER().
 */
export async function getUserRank(
  supabase: SupabaseClient<Database>,
  userId: string,
  sort: LeaderboardSort = "hit_rate"
): Promise<UserRank | null> {
  // Step 1: Get the user's leaderboard entry with profile
  const { data: entryData, error: entryError } = await typedFrom(
    supabase,
    "leaderboard_entries"
  )
    .select(
      "*, profiles!leaderboard_entries_user_id_fkey(id, username, display_name, avatar_url, icon_config)"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (entryError) throw new Error(entryError.message);

  if (!entryData) return null;

  const entry = toLeaderboardRow(entryData as Record<string, unknown>);

  // Step 2: Get rank via single Postgres function (replaces 3 COUNT queries)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rankData, error: rankError } = await (supabase.rpc as any)(
    "get_user_rank",
    { p_user_id: userId, p_sort: sort }
  );

  if (rankError) throw new Error(rankError.message);

  const rank = (rankData as unknown as { rank: number }[] | null)?.[0]?.rank ?? 1;

  return { rank, entry };
}
