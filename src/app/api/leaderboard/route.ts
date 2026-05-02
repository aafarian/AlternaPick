import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import {
  getGlobalLeaderboard,
  getFriendsLeaderboard,
  getUserRank,
  type LeaderboardRow,
  type LeaderboardSort,
} from "@/lib/leaderboard/queries";

export interface LeaderboardEntryWithProfile {
  rank: number;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    icon_config: Record<string, unknown> | null;
  };
  stats: {
    total_cards: number;
    total_correct_picks: number;
    win_rate: number;
    current_streak: number;
    best_streak: number;
    h2h_wins: number;
    h2h_losses: number;
    fire_tokens_lifetime: number;
  };
}

export interface LeaderboardResponse {
  entries: LeaderboardEntryWithProfile[];
  total: number;
  userRank: {
    rank: number;
    stats: LeaderboardEntryWithProfile["stats"];
  } | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function rowToEntry(row: LeaderboardRow): LeaderboardEntryWithProfile["stats"] {
  return {
    total_cards: row.total_cards,
    total_correct_picks: row.total_correct_picks,
    win_rate: row.win_rate,
    current_streak: row.current_streak,
    best_streak: row.best_streak,
    h2h_wins: row.h2h_wins,
    h2h_losses: row.h2h_losses,
    fire_tokens_lifetime: row.fire_tokens_lifetime,
  };
}

/**
 * GET /api/leaderboard
 * Returns paginated leaderboard data with user profiles.
 *
 * Query params:
 *   scope   - "global" (default) or "friends"
 *   limit   - Number of entries (default: 50, max: 100)
 *   offset  - Pagination offset (default: 0)
 *   sort    - Sort field: "hit_rate" (default) or "h2h"
 *
 * scope=global is public (no auth required).
 * scope=friends requires authentication.
 * If authenticated, the response includes the current user's rank and stats.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Parse query params
    const scope = searchParams.get("scope") ?? "global";
    const limitParam = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
    const offsetParam = parseInt(searchParams.get("offset") ?? "0", 10);

    const sortParam = searchParams.get("sort") ?? "hit_rate";

    // Validate scope
    if (scope !== "global" && scope !== "friends") {
      return badRequest("Invalid scope. Must be 'global' or 'friends'.");
    }

    // Validate sort
    if (sortParam !== "hit_rate" && sortParam !== "h2h" && sortParam !== "flame_tokens") {
      return badRequest("Invalid sort. Must be 'hit_rate', 'h2h', or 'flame_tokens'.");
    }
    const sort: LeaderboardSort = sortParam;

    // Clamp limit and offset
    const limit = Math.min(
      Math.max(1, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam),
      MAX_LIMIT
    );
    const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam);

    // Get current user (optional for global, required for friends)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (scope === "friends" && !user) {
      return unauthorized();
    }

    // Fetch leaderboard rows from query layer
    let rows: LeaderboardRow[];

    if (scope === "friends" && user) {
      rows = await getFriendsLeaderboard(supabase, user.id, limit, offset, sort);
    } else {
      rows = await getGlobalLeaderboard(supabase, limit, offset, sort);
    }

    // Map rows to response shape with rank numbers
    const entries: LeaderboardEntryWithProfile[] = rows.map((row, index) => ({
      rank: offset + index + 1,
      user: {
        id: row.profile.id,
        username: row.profile.username,
        display_name: row.profile.display_name,
        avatar_url: row.profile.avatar_url,
        icon_config: row.profile.icon_config,
      },
      stats: rowToEntry(row),
    }));

    // Get total count for pagination
    // Fetch count separately to support pagination metadata
    let total = entries.length + offset;
    if (entries.length === limit) {
      // There may be more entries; get exact count
      const { count, error: countError } = await (
        supabase.from("leaderboard_entries") as any
      ).select("id", { count: "exact", head: true });

      if (!countError && count !== null) {
        total = count;
      }
    }

    // Compute the authenticated user's rank and stats
    let userRank: LeaderboardResponse["userRank"] = null;

    if (user) {
      const rankResult = await getUserRank(supabase, user.id, sort);
      if (rankResult) {
        userRank = {
          rank: rankResult.rank,
          stats: rowToEntry(rankResult.entry),
        };
      }
    }

    const response: LeaderboardResponse = {
      entries,
      total,
      userRank,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, "Failed to fetch leaderboard");
  }
}
