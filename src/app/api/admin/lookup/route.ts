import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, notFound, handleApiError } from "@/lib/api/errors";
import type { AdminLookupResult } from "@/lib/admin/types";

// ---------------------------------------------------------------------------
// Row types for query results
// ---------------------------------------------------------------------------

type ProfileRow = {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_deactivated: boolean;
  created_at: string;
  updated_at: string;
};

type CardRow = {
  id: string;
  user_id: string | null;
  challenge_id: string | null;
  status: string;
  score: number;
  total_picks: number;
  card_size: number;
  game_mode: string;
  locked_at: string | null;
  resolved_at: string | null;
  created_at: string;
  user: { id: string; username: string; display_name: string | null } | null;
  picks: Array<{
    id: string;
    selection: string;
    result: string;
    actual_value: number | null;
    prop: {
      player_name: string;
      stat_category: string;
      line: number;
    } | null;
  }>;
};

type ChallengeRow = {
  id: string;
  challenger_id: string;
  opponent_id: string | null;
  status: string;
  game_mode: string;
  card_size: number;
  message: string | null;
  winner_id: string | null;
  created_at: string;
  resolved_at: string | null;
  lobby_type: "1v1" | "group" | null;
  challenger: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  opponent: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type PickRow = {
  id: string;
  card_id: string;
  prop_id: string;
  selection: string;
  result: string;
  actual_value: number | null;
  created_at: string;
  card: {
    id: string;
    user_id: string | null;
    status: string;
    user: { id: string; username: string; display_name: string | null } | null;
  } | null;
  prop: {
    id: string;
    player_name: string;
    stat_category: string;
    line: number;
    player_team: string | null;
    game: { home_team: string; away_team: string } | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildProfileData(row: ProfileRow): Record<string, unknown> {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isDeactivated: row.is_deactivated,
    signupDate: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildCardData(row: CardRow): Record<string, unknown> {
  return {
    id: row.id,
    userId: row.user_id,
    challengeId: row.challenge_id,
    status: row.status,
    score: row.score,
    totalPicks: row.total_picks,
    cardSize: row.card_size,
    gameMode: row.game_mode,
    lockedAt: row.locked_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    user: row.user
      ? {
          id: row.user.id,
          username: row.user.username,
          displayName: row.user.display_name,
        }
      : null,
    picks: (row.picks ?? []).map((p) => ({
      id: p.id,
      selection: p.selection,
      result: p.result,
      actualValue: p.actual_value,
      playerName: p.prop?.player_name ?? null,
      statCategory: p.prop?.stat_category ?? null,
      line: p.prop?.line ?? null,
    })),
  };
}

function buildChallengeData(row: ChallengeRow): Record<string, unknown> {
  return {
    id: row.id,
    status: row.status,
    gameMode: row.game_mode,
    cardSize: row.card_size,
    message: row.message,
    winnerId: row.winner_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    lobbyType: row.lobby_type ?? "1v1",
    challenger: row.challenger
      ? {
          id: row.challenger.id,
          username: row.challenger.username,
          displayName: row.challenger.display_name,
          avatarUrl: row.challenger.avatar_url,
        }
      : null,
    opponent: row.opponent
      ? {
          id: row.opponent.id,
          username: row.opponent.username,
          displayName: row.opponent.display_name,
          avatarUrl: row.opponent.avatar_url,
        }
      : null,
  };
}

function buildPickData(row: PickRow): Record<string, unknown> {
  return {
    id: row.id,
    cardId: row.card_id,
    propId: row.prop_id,
    selection: row.selection,
    result: row.result,
    actualValue: row.actual_value,
    createdAt: row.created_at,
    card: row.card
      ? {
          id: row.card.id,
          userId: row.card.user_id,
          status: row.card.status,
          user: row.card.user
            ? {
                id: row.card.user.id,
                username: row.card.user.username,
                displayName: row.card.user.display_name,
              }
            : null,
        }
      : null,
    prop: row.prop
      ? {
          id: row.prop.id,
          playerName: row.prop.player_name,
          statCategory: row.prop.stat_category,
          line: row.prop.line,
          playerTeam: row.prop.player_team,
          homeTeam: row.prop.game?.home_team ?? null,
          awayTeam: row.prop.game?.away_team ?? null,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/admin/lookup?id=<uuid>
// ---------------------------------------------------------------------------

/**
 * Record lookup endpoint: searches profiles, cards, challenges, and picks
 * tables in parallel to find which one contains the given UUID.
 *
 * Requires admin access; returns 404 for non-admin or unauthenticated users
 * so the endpoint is not discoverable.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return auth.response;
    }

    const id = request.nextUrl.searchParams.get("id");

    if (!id || !UUID_REGEX.test(id)) {
      return badRequest("A valid UUID is required");
    }

    const supabase = createAdminClient();

    // Query all four tables in parallel — only one will match
    const [profileResult, cardResult, challengeResult, pickResult] =
      await Promise.allSettled([
         
        (supabase.from("profiles") as any)
          .select(
            "id, username, email, display_name, avatar_url, is_deactivated, created_at, updated_at"
          )
          .eq("id", id)
          .single(),

         
        (supabase.from("cards") as any)
          .select(
            "id, user_id, challenge_id, status, score, total_picks, card_size, game_mode, locked_at, resolved_at, created_at, user:profiles!cards_user_id_fkey(id, username, display_name), picks(id, selection, result, actual_value, prop:props!picks_prop_id_fkey(player_name, stat_category, line))"
          )
          .eq("id", id)
          .single(),

         
        (supabase.from("challenges") as any)
          .select(
            "id, challenger_id, opponent_id, status, game_mode, card_size, message, winner_id, created_at, resolved_at, lobby_type, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url)"
          )
          .eq("id", id)
          .single(),

         
        (supabase.from("picks") as any)
          .select(
            "id, card_id, prop_id, selection, result, actual_value, created_at, card:cards!picks_card_id_fkey(id, user_id, status, user:profiles!cards_user_id_fkey(id, username, display_name)), prop:props!picks_prop_id_fkey(id, player_name, stat_category, line, player_team, game:games!props_game_id_fkey(home_team, away_team))"
          )
          .eq("id", id)
          .single(),
      ]);

    // Check each result in priority order: profile > card > challenge > pick
    if (
      profileResult.status === "fulfilled" &&
      profileResult.value.data &&
      !profileResult.value.error
    ) {
      const result: AdminLookupResult = {
        type: "profile",
        id,
        data: buildProfileData(profileResult.value.data as ProfileRow),
      };
      return NextResponse.json(result);
    }

    if (
      cardResult.status === "fulfilled" &&
      cardResult.value.data &&
      !cardResult.value.error
    ) {
      const result: AdminLookupResult = {
        type: "card",
        id,
        data: buildCardData(cardResult.value.data as CardRow),
      };
      return NextResponse.json(result);
    }

    if (
      challengeResult.status === "fulfilled" &&
      challengeResult.value.data &&
      !challengeResult.value.error
    ) {
      const result: AdminLookupResult = {
        type: "challenge",
        id,
        data: buildChallengeData(challengeResult.value.data as ChallengeRow),
      };
      return NextResponse.json(result);
    }

    if (
      pickResult.status === "fulfilled" &&
      pickResult.value.data &&
      !pickResult.value.error
    ) {
      const result: AdminLookupResult = {
        type: "pick",
        id,
        data: buildPickData(pickResult.value.data as PickRow),
      };
      return NextResponse.json(result);
    }

    // UUID not found in any table
    return notFound("Record");
  } catch (error) {
    return handleApiError(error, "Failed to perform record lookup");
  }
}
