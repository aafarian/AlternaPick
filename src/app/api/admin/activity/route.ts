import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api/errors";
import type {
  AdminActivityItem,
  AdminActivityEventType,
  AdminActivityFeedResponse,
} from "@/lib/admin/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a unique id for an activity item: `{table}_{rowId}_{eventType}` */
function activityId(table: string, rowId: string, type: string): string {
  return `${table}_${rowId}_${type}`;
}

/** Default date range — last 7 days. */
function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    dateFrom: weekAgo.toISOString(),
    dateTo: now.toISOString(),
  };
}

// Map from event type to the tables that need querying
const EVENT_TYPE_TABLES: Record<AdminActivityEventType, string[]> = {
  user_signup: ["profiles"],
  card_locked: ["cards"],
  card_resolved: ["cards"],
  challenge_created: ["challenges"],
  challenge_accepted: ["challenges"],
  challenge_declined: ["challenges"],
  challenge_resolved: ["challenges"],
  pick_made: ["picks"],
  achievement_unlocked: ["user_achievements"],
  friend_request_sent: ["friendships"],
  friend_accepted: ["friendships"],
  reaction_added: ["reactions"],
};

// ---------------------------------------------------------------------------
// Table query builders — each returns AdminActivityItem[]
// ---------------------------------------------------------------------------

type QueryCtx = {
  supabase: ReturnType<typeof createAdminClient>;
  dateFrom: string;
  dateTo: string;
  userId?: string;
  /** Per-source row cap to prevent unbounded fetches. */
  rowLimit: number;
};

 
type AnyRow = any;

async function queryUserSignups(ctx: QueryCtx): Promise<AdminActivityItem[]> {
  let q = ctx.supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at")
    .gte("created_at", ctx.dateFrom)
    .lte("created_at", ctx.dateTo);

  if (ctx.userId) q = q.eq("id", ctx.userId);

  q = q.order("created_at", { ascending: false }).limit(ctx.rowLimit);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return ((data ?? []) as AnyRow[]).map((row) => ({
    id: activityId("profiles", row.id, "user_signup"),
    type: "user_signup" as const,
    userId: row.id,
    username: row.username ?? "unknown",
    displayName: row.display_name ?? null,
    avatarUrl: row.avatar_url ?? null,
    description: "signed up",
    metadata: {},
    timestamp: row.created_at,
  }));
}

async function queryCardsLocked(ctx: QueryCtx): Promise<AdminActivityItem[]> {
  let q = ctx.supabase
    .from("cards")
    .select(
      "id, user_id, card_size, game_mode, locked_at, profiles!cards_user_id_fkey(username, display_name, avatar_url)"
    )
    .not("locked_at", "is", null)
    .gte("locked_at", ctx.dateFrom)
    .lte("locked_at", ctx.dateTo);

  if (ctx.userId) q = q.eq("user_id", ctx.userId);

  q = q.order("locked_at", { ascending: false }).limit(ctx.rowLimit);

   
  const { data, error } = await (q as any);
  if (error) throw new Error(error.message);

  return ((data ?? []) as AnyRow[]).map((row) => {
    const profile = row.profiles ?? {};
    return {
      id: activityId("cards", row.id, "card_locked"),
      type: "card_locked" as const,
      userId: row.user_id ?? "",
      username: profile.username ?? "unknown",
      displayName: profile.display_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      description: `locked a ${row.card_size}-pick ${row.game_mode} card`,
      metadata: {
        cardId: row.id,
        cardSize: row.card_size,
        gameMode: row.game_mode,
      },
      timestamp: row.locked_at,
    };
  });
}

async function queryCardsResolved(
  ctx: QueryCtx
): Promise<AdminActivityItem[]> {
  let q = ctx.supabase
    .from("cards")
    .select(
      "id, user_id, score, total_picks, resolved_at, profiles!cards_user_id_fkey(username, display_name, avatar_url)"
    )
    .not("resolved_at", "is", null)
    .gte("resolved_at", ctx.dateFrom)
    .lte("resolved_at", ctx.dateTo);

  if (ctx.userId) q = q.eq("user_id", ctx.userId);

  q = q.order("resolved_at", { ascending: false }).limit(ctx.rowLimit);

   
  const { data, error } = await (q as any);
  if (error) throw new Error(error.message);

  return ((data ?? []) as AnyRow[]).map((row) => {
    const profile = row.profiles ?? {};
    return {
      id: activityId("cards", row.id, "card_resolved"),
      type: "card_resolved" as const,
      userId: row.user_id ?? "",
      username: profile.username ?? "unknown",
      displayName: profile.display_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      description: `resolved a card: ${row.score}/${row.total_picks}`,
      metadata: {
        cardId: row.id,
        score: row.score,
        totalPicks: row.total_picks,
      },
      timestamp: row.resolved_at,
    };
  });
}

async function queryChallengesCreated(
  ctx: QueryCtx
): Promise<AdminActivityItem[]> {
  let q = ctx.supabase
    .from("challenges")
    .select(
      "id, challenger_id, opponent_id, game_mode, lobby_type, max_participants, created_at, challenger:profiles!challenges_challenger_id_fkey(username, display_name, avatar_url), opponent:profiles!challenges_opponent_id_fkey(username, display_name, avatar_url)"
    )
    .gte("created_at", ctx.dateFrom)
    .lte("created_at", ctx.dateTo);

  if (ctx.userId) q = q.eq("challenger_id", ctx.userId);

  q = q.order("created_at", { ascending: false }).limit(ctx.rowLimit);


  const { data, error } = await (q as any);
  if (error) throw new Error(error.message);

  return ((data ?? []) as AnyRow[]).map((row) => {
    const challenger = row.challenger ?? {};
    const opponent = row.opponent ?? {};
    const isGroup = row.lobby_type === "group";
    const description = isGroup
      ? `created a ${row.game_mode} group challenge${
          row.max_participants ? ` (${row.max_participants} players)` : ""
        }`
      : `created a ${row.game_mode} challenge against @${opponent.username ?? "unknown"}`;
    return {
      id: activityId("challenges", row.id, "challenge_created"),
      type: "challenge_created" as const,
      userId: row.challenger_id,
      username: challenger.username ?? "unknown",
      displayName: challenger.display_name ?? null,
      avatarUrl: challenger.avatar_url ?? null,
      description,
      metadata: {
        challengeId: row.id,
        opponentId: row.opponent_id,
        gameMode: row.game_mode,
        lobbyType: row.lobby_type ?? "1v1",
      },
      timestamp: row.created_at,
    };
  });
}

async function queryChallengesAccepted(
  ctx: QueryCtx
): Promise<AdminActivityItem[]> {
  // Challenges that are currently accepted (or beyond) — use created_at as
  // approximate timestamp since there's no explicit accepted_at column.
  // Note: only fires for 1v1 challenges; group challenges have no single
  // "accepted" event since acceptance happens per-participant.
  let q = ctx.supabase
    .from("challenges")
    .select(
      "id, challenger_id, opponent_id, game_mode, status, lobby_type, created_at, challenger:profiles!challenges_challenger_id_fkey(username, display_name, avatar_url), opponent:profiles!challenges_opponent_id_fkey(username, display_name, avatar_url)"
    )
    .in("status", ["accepted", "active", "resolved"])
    .eq("lobby_type", "1v1")
    .gte("created_at", ctx.dateFrom)
    .lte("created_at", ctx.dateTo);

  if (ctx.userId) q = q.eq("opponent_id", ctx.userId);

  q = q.order("created_at", { ascending: false }).limit(ctx.rowLimit);


  const { data, error } = await (q as any);
  if (error) throw new Error(error.message);

  return ((data ?? []) as AnyRow[])
    .filter((row) => row.opponent_id !== null)
    .map((row) => {
      const opponent = row.opponent ?? {};
      const challenger = row.challenger ?? {};
      return {
        id: activityId("challenges", row.id, "challenge_accepted"),
        type: "challenge_accepted" as const,
        userId: row.opponent_id,
        username: opponent.username ?? "unknown",
        displayName: opponent.display_name ?? null,
        avatarUrl: opponent.avatar_url ?? null,
        description: `accepted a ${row.game_mode} challenge from @${challenger.username ?? "unknown"}`,
        metadata: {
          challengeId: row.id,
          challengerId: row.challenger_id,
          gameMode: row.game_mode,
          lobbyType: row.lobby_type ?? "1v1",
        },
        timestamp: row.created_at,
      };
    });
}

async function queryChallengesDeclined(
  ctx: QueryCtx
): Promise<AdminActivityItem[]> {
  // Only 1v1 challenges produce a "declined" event. Group challenges decline
  // per participant via challenge_participants.status; not surfaced here.
  let q = ctx.supabase
    .from("challenges")
    .select(
      "id, challenger_id, opponent_id, game_mode, lobby_type, created_at, challenger:profiles!challenges_challenger_id_fkey(username, display_name, avatar_url), opponent:profiles!challenges_opponent_id_fkey(username, display_name, avatar_url)"
    )
    .eq("status", "declined")
    .eq("lobby_type", "1v1")
    .gte("created_at", ctx.dateFrom)
    .lte("created_at", ctx.dateTo);

  if (ctx.userId) q = q.eq("opponent_id", ctx.userId);

  q = q.order("created_at", { ascending: false }).limit(ctx.rowLimit);


  const { data, error } = await (q as any);
  if (error) throw new Error(error.message);

  return ((data ?? []) as AnyRow[])
    .filter((row) => row.opponent_id !== null)
    .map((row) => {
      const opponent = row.opponent ?? {};
      const challenger = row.challenger ?? {};
      return {
        id: activityId("challenges", row.id, "challenge_declined"),
        type: "challenge_declined" as const,
        userId: row.opponent_id,
        username: opponent.username ?? "unknown",
        displayName: opponent.display_name ?? null,
        avatarUrl: opponent.avatar_url ?? null,
        description: `declined a ${row.game_mode} challenge from @${challenger.username ?? "unknown"}`,
        metadata: {
          challengeId: row.id,
          challengerId: row.challenger_id,
          gameMode: row.game_mode,
          lobbyType: row.lobby_type ?? "1v1",
        },
        timestamp: row.created_at,
      };
    });
}

async function queryChallengesResolved(
  ctx: QueryCtx
): Promise<AdminActivityItem[]> {
  let q = ctx.supabase
    .from("challenges")
    .select(
      "id, challenger_id, opponent_id, winner_id, game_mode, lobby_type, resolved_at, challenger:profiles!challenges_challenger_id_fkey(username, display_name, avatar_url), opponent:profiles!challenges_opponent_id_fkey(username, display_name, avatar_url)"
    )
    .eq("status", "resolved")
    .not("resolved_at", "is", null)
    .gte("resolved_at", ctx.dateFrom)
    .lte("resolved_at", ctx.dateTo);

  if (ctx.userId) {
    q = q.or(
      `challenger_id.eq.${ctx.userId},opponent_id.eq.${ctx.userId}`
    );
  }

  q = q.order("resolved_at", { ascending: false }).limit(ctx.rowLimit);


  const { data, error } = await (q as any);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AnyRow[];

  // For group challenges with a winner, look up the winner's username from
  // challenge_participants → profiles. (For 1v1 we already have it joined.)
  const groupWinnerLookups = rows.filter(
    (r) => r.lobby_type === "group" && r.winner_id,
  );

  const groupWinnerUsernames = new Map<string, string>();
  if (groupWinnerLookups.length > 0) {
    const winnerIds = Array.from(
      new Set(groupWinnerLookups.map((r) => r.winner_id as string)),
    );

    const { data: winnerProfiles } = await (
      ctx.supabase.from("profiles") as any
    )
      .select("id, username")
      .in("id", winnerIds);

    for (const p of (winnerProfiles as { id: string; username: string }[] | null) ?? []) {
      groupWinnerUsernames.set(p.id, p.username);
    }
  }

  return rows.map((row) => {
    const challenger = row.challenger ?? {};
    const opponent = row.opponent ?? {};
    const isGroup = row.lobby_type === "group";

    let winnerUsername: string | null = null;
    if (row.winner_id) {
      if (isGroup) {
        winnerUsername = groupWinnerUsernames.get(row.winner_id) ?? null;
      } else if (row.winner_id === row.challenger_id) {
        winnerUsername = challenger.username ?? null;
      } else if (row.winner_id === row.opponent_id) {
        winnerUsername = opponent.username ?? null;
      }
    }

    const description = winnerUsername
      ? `${isGroup ? "group " : ""}challenge resolved — winner: @${winnerUsername}`
      : isGroup
        ? "group challenge resolved"
        : "challenge resolved — tie";

    return {
      id: activityId("challenges", row.id, "challenge_resolved"),
      type: "challenge_resolved" as const,
      userId: row.challenger_id,
      username: challenger.username ?? "unknown",
      displayName: challenger.display_name ?? null,
      avatarUrl: challenger.avatar_url ?? null,
      description,
      metadata: {
        challengeId: row.id,
        winnerId: row.winner_id,
        lobbyType: row.lobby_type ?? "1v1",
      },
      timestamp: row.resolved_at,
    };
  });
}

async function queryPicksMade(ctx: QueryCtx): Promise<AdminActivityItem[]> {
  // Picks don't have user_id directly — they belong to a card which has user_id.
  // We join picks -> cards -> profiles and picks -> props for player/stat info.
  let q = ctx.supabase
    .from("picks")
    .select(
      "id, card_id, selection, created_at, props!picks_prop_id_fkey(player_name, stat_category), cards!picks_card_id_fkey(user_id, profiles!cards_user_id_fkey(username, display_name, avatar_url))"
    )
    .gte("created_at", ctx.dateFrom)
    .lte("created_at", ctx.dateTo);

  // When userId is provided, first fetch the user's card IDs to filter at DB level
  if (ctx.userId) {
     
    const { data: userCards } = await (ctx.supabase.from("cards") as any)
      .select("id")
      .eq("user_id", ctx.userId);
    const cardIds = ((userCards ?? []) as { id: string }[]).map((c) => c.id);
    if (cardIds.length === 0) return [];
    q = q.in("card_id", cardIds);
  }

  q = q.order("created_at", { ascending: false }).limit(ctx.rowLimit);

   
  const { data, error } = await (q as any);
  if (error) throw new Error(error.message);

  return ((data ?? []) as AnyRow[]).map((row) => {
    const card = row.cards ?? {};
    const profile = card.profiles ?? {};
    const prop = row.props ?? {};
    return {
      id: activityId("picks", row.id, "pick_made"),
      type: "pick_made" as const,
      userId: card.user_id ?? "",
      username: profile.username ?? "unknown",
      displayName: profile.display_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      description: `made a pick: ${row.selection} on ${prop.player_name ?? "unknown"} ${prop.stat_category ?? ""}`,
      metadata: {
        pickId: row.id,
        cardId: row.card_id,
        selection: row.selection,
      },
      timestamp: row.created_at,
    };
  });
}

async function queryAchievementsUnlocked(
  ctx: QueryCtx
): Promise<AdminActivityItem[]> {
  let q = ctx.supabase
    .from("user_achievements")
    .select(
      "id, user_id, achievement_id, unlocked_at, achievements!user_achievements_achievement_id_fkey(name), profiles!user_achievements_user_id_fkey(username, display_name, avatar_url)"
    )
    .gte("unlocked_at", ctx.dateFrom)
    .lte("unlocked_at", ctx.dateTo);

  if (ctx.userId) q = q.eq("user_id", ctx.userId);

  q = q.order("unlocked_at", { ascending: false }).limit(ctx.rowLimit);

   
  const { data, error } = await (q as any);
  if (error) throw new Error(error.message);

  return ((data ?? []) as AnyRow[]).map((row) => {
    const profile = row.profiles ?? {};
    const achievement = row.achievements ?? {};
    return {
      id: activityId("user_achievements", row.id, "achievement_unlocked"),
      type: "achievement_unlocked" as const,
      userId: row.user_id,
      username: profile.username ?? "unknown",
      displayName: profile.display_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      description: `unlocked achievement: ${achievement.name ?? "unknown"}`,
      metadata: {
        achievementId: row.achievement_id,
        achievementName: achievement.name ?? null,
      },
      timestamp: row.unlocked_at,
    };
  });
}

async function queryFriendRequestsSent(
  ctx: QueryCtx
): Promise<AdminActivityItem[]> {
  let q = ctx.supabase
    .from("friendships")
    .select(
      "id, requester_id, addressee_id, status, created_at, profiles!friendships_requester_id_fkey(username, display_name, avatar_url)"
    )
    .eq("status", "pending")
    .gte("created_at", ctx.dateFrom)
    .lte("created_at", ctx.dateTo);

  if (ctx.userId) q = q.eq("requester_id", ctx.userId);

  q = q.order("created_at", { ascending: false }).limit(ctx.rowLimit);

   
  const { data, error } = await (q as any);
  if (error) throw new Error(error.message);

  return ((data ?? []) as AnyRow[]).map((row) => {
    const profile = row.profiles ?? {};
    return {
      id: activityId("friendships", row.id, "friend_request_sent"),
      type: "friend_request_sent" as const,
      userId: row.requester_id,
      username: profile.username ?? "unknown",
      displayName: profile.display_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      description: "sent a friend request",
      metadata: {
        friendshipId: row.id,
        addresseeId: row.addressee_id,
      },
      timestamp: row.created_at,
    };
  });
}

async function queryFriendsAccepted(
  ctx: QueryCtx
): Promise<AdminActivityItem[]> {
  let q = ctx.supabase
    .from("friendships")
    .select(
      "id, requester_id, addressee_id, status, updated_at, profiles!friendships_addressee_id_fkey(username, display_name, avatar_url)"
    )
    .eq("status", "accepted")
    .gte("updated_at", ctx.dateFrom)
    .lte("updated_at", ctx.dateTo);

  if (ctx.userId) q = q.eq("addressee_id", ctx.userId);

  q = q.order("updated_at", { ascending: false }).limit(ctx.rowLimit);

   
  const { data, error } = await (q as any);
  if (error) throw new Error(error.message);

  return ((data ?? []) as AnyRow[]).map((row) => {
    const profile = row.profiles ?? {};
    return {
      id: activityId("friendships", row.id, "friend_accepted"),
      type: "friend_accepted" as const,
      userId: row.addressee_id,
      username: profile.username ?? "unknown",
      displayName: profile.display_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      description: "accepted a friend request",
      metadata: {
        friendshipId: row.id,
        requesterId: row.requester_id,
      },
      timestamp: row.updated_at,
    };
  });
}

async function queryReactionsAdded(
  ctx: QueryCtx
): Promise<AdminActivityItem[]> {
  let q = ctx.supabase
    .from("reactions")
    .select(
      "id, user_id, target_type, target_id, emoji, created_at, profiles!reactions_user_id_fkey(username, display_name, avatar_url)"
    )
    .gte("created_at", ctx.dateFrom)
    .lte("created_at", ctx.dateTo);

  if (ctx.userId) q = q.eq("user_id", ctx.userId);

  q = q.order("created_at", { ascending: false }).limit(ctx.rowLimit);

   
  const { data, error } = await (q as any);
  if (error) throw new Error(error.message);

  return ((data ?? []) as AnyRow[]).map((row) => {
    const profile = row.profiles ?? {};
    return {
      id: activityId("reactions", row.id, "reaction_added"),
      type: "reaction_added" as const,
      userId: row.user_id,
      username: profile.username ?? "unknown",
      displayName: profile.display_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      description: `reacted ${row.emoji} to a ${row.target_type}`,
      metadata: {
        reactionId: row.id,
        targetType: row.target_type,
        emoji: row.emoji,
      },
      timestamp: row.created_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Map from table name to the query functions that target it
// ---------------------------------------------------------------------------

const TABLE_QUERIES: Record<
  string,
  ((ctx: QueryCtx) => Promise<AdminActivityItem[]>)[]
> = {
  profiles: [queryUserSignups],
  cards: [queryCardsLocked, queryCardsResolved],
  challenges: [
    queryChallengesCreated,
    queryChallengesAccepted,
    queryChallengesDeclined,
    queryChallengesResolved,
  ],
  picks: [queryPicksMade],
  user_achievements: [queryAchievementsUnlocked],
  friendships: [queryFriendRequestsSent, queryFriendsAccepted],
  reactions: [queryReactionsAdded],
};

// ---------------------------------------------------------------------------
// GET /api/admin/activity
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/activity
 * Returns a paginated, filterable activity feed across all platform events.
 *
 * Query params:
 *   page      — page number (default 1)
 *   pageSize  — items per page (default 50, max 100)
 *   type      — AdminActivityEventType filter (only query relevant table)
 *   userId    — filter events by a specific user UUID
 *   dateFrom  — ISO date string for range start (default: 7 days ago)
 *   dateTo    — ISO date string for range end (default: now)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return auth.response;
    }

    const { searchParams } = request.nextUrl;

    // Parse query params
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10))
    );
    const typeFilter = searchParams.get("type") as
      | AdminActivityEventType
      | null;
    const rawUserId = searchParams.get("userId") ?? undefined;
    // Validate userId as UUID to prevent filter injection in .or() calls
    const userId =
      rawUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawUserId)
        ? rawUserId
        : undefined;

    const defaults = defaultDateRange();
    const dateFrom = searchParams.get("dateFrom") ?? defaults.dateFrom;
    const dateTo = searchParams.get("dateTo") ?? defaults.dateTo;

    const supabase = createAdminClient();

    const ctx: QueryCtx = {
      supabase,
      dateFrom,
      dateTo,
      userId,
      rowLimit: pageSize * 2,
    };

    // Determine which query functions to run
    let queryFns: ((ctx: QueryCtx) => Promise<AdminActivityItem[]>)[];

    if (typeFilter) {
      // Optimization: only query the table(s) relevant to this event type
      const tables = EVENT_TYPE_TABLES[typeFilter];
      if (!tables) {
        return NextResponse.json(
          { error: `Invalid event type: ${typeFilter}` },
          { status: 400 }
        );
      }

      // Build the specific query function list for this event type
      const typeToFn: Record<
        AdminActivityEventType,
        (ctx: QueryCtx) => Promise<AdminActivityItem[]>
      > = {
        user_signup: queryUserSignups,
        card_locked: queryCardsLocked,
        card_resolved: queryCardsResolved,
        challenge_created: queryChallengesCreated,
        challenge_accepted: queryChallengesAccepted,
        challenge_declined: queryChallengesDeclined,
        challenge_resolved: queryChallengesResolved,
        pick_made: queryPicksMade,
        achievement_unlocked: queryAchievementsUnlocked,
        friend_request_sent: queryFriendRequestsSent,
        friend_accepted: queryFriendsAccepted,
        reaction_added: queryReactionsAdded,
      };

      queryFns = [typeToFn[typeFilter]];
    } else {
      // Query all tables
      queryFns = Object.values(TABLE_QUERIES).flat();
    }

    // Run all queries in parallel
    const results = await Promise.all(queryFns.map((fn) => fn(ctx)));
    const allItems = results.flat();

    // Sort by timestamp descending
    allItems.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Total before pagination
    const total = allItems.length;

    // Apply pagination
    const start = (page - 1) * pageSize;
    const items = allItems.slice(start, start + pageSize);

    const response: AdminActivityFeedResponse = {
      items,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch admin activity feed");
  }
}
