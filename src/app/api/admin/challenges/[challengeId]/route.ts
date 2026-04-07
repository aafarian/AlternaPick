import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, badRequest, handleApiError } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/api/validation";
import type {
  AdminChallengeDetail,
  AdminChallengePlayerSide,
  AdminCardPickDetail,
} from "@/lib/admin/types";
import type {
  CardStatus,
  GameMode,
  PickResult,
  PickSelection,
  StatCategory,
} from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Row types for query results
// ---------------------------------------------------------------------------

type ChallengeRow = {
  id: string;
  status: string;
  game_mode: GameMode;
  card_size: number;
  message: string | null;
  winner_id: string | null;
  created_at: string;
  resolved_at: string | null;
  lobby_type: "1v1" | "group" | null;
  challenger_id: string;
  opponent_id: string | null;
  challenger: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  opponent: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type ParticipantRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  card_id: string | null;
  is_creator: boolean;
};

type ParticipantWithProfileRow = ParticipantRow & {
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type CardRow = {
  id: string;
  user_id: string | null;
  status: CardStatus;
  score: number;
  total_picks: number;
  card_size: number;
  game_mode: GameMode;
  challenge_id: string | null;
  locked_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

type PickRow = {
  id: string;
  card_id: string;
  prop_id: string;
  selection: PickSelection;
  result: PickResult;
  actual_value: number | null;
  prop: {
    id: string;
    player_name: string;
    player_team: string | null;
    stat_category: StatCategory;
    line: number;
    game: {
      home_team: string;
      away_team: string;
      commence_time: string;
    };
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapPicksToDetail(picks: PickRow[]): AdminCardPickDetail[] {
  return picks.map((p) => ({
    id: p.id,
    propId: p.prop_id,
    playerName: p.prop.player_name,
    playerTeam: p.prop.player_team,
    statCategory: p.prop.stat_category,
    line: p.prop.line,
    selection: p.selection,
    result: p.result,
    actualValue: p.actual_value,
    homeTeam: p.prop.game.home_team,
    awayTeam: p.prop.game.away_team,
    commenceTime: p.prop.game.commence_time,
  }));
}

/**
 * GET /api/admin/challenges/:challengeId
 * Returns full challenge detail with both players' cards, picks, and prop
 * details for a side-by-side comparison view.
 *
 * Requires admin access; returns 404 for non-admin or unauthenticated users
 * so the endpoint is not discoverable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return auth.response;
    }

    const { challengeId } = await params;

    if (!UUID_RE.test(challengeId)) {
      return badRequest("Invalid challenge ID format");
    }

    const supabase = createAdminClient();

    // Fetch challenge with both players' profiles joined
     
    const { data: challengeData, error: challengeError } = await (
      supabase.from("challenges") as any
    )
      .select(
        "id, status, game_mode, card_size, message, winner_id, created_at, resolved_at, lobby_type, challenger_id, opponent_id, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url)"
      )
      .eq("id", challengeId)
      .single();

    if (challengeError || !challengeData) {
      return notFound("Challenge");
    }

    const challenge = challengeData as ChallengeRow;

    // Fetch both players' cards for this challenge in parallel
     
    const { data: cardsData } = await (supabase.from("cards") as any)
      .select(
        "id, user_id, status, score, total_picks, card_size, game_mode, challenge_id, locked_at, resolved_at, created_at"
      )
      .eq("challenge_id", challengeId);

    const cards = (cardsData as CardRow[] | null) ?? [];

    const lobbyType: "1v1" | "group" =
      challenge.lobby_type === "group" ? "group" : "1v1";

    // For group challenges, fetch all participant rows with profiles joined.
    // For 1v1 with NULL opponent_id, fetch the single guest participant.
    let groupParticipants: ParticipantWithProfileRow[] = [];
    let guestParticipant: ParticipantRow | null = null;

    if (lobbyType === "group") {

      const { data: participantRows } = await (supabase.from("challenge_participants") as any)
        .select(
          "id, user_id, email, card_id, is_creator, user:profiles!challenge_participants_user_id_fkey(id, username, display_name, avatar_url)",
        )
        .eq("challenge_id", challengeId);

      groupParticipants =
        (participantRows as ParticipantWithProfileRow[] | null) ?? [];
    } else if (!challenge.opponent_id) {

      const { data: participantRows } = await (supabase.from("challenge_participants") as any)
        .select("id, user_id, email, card_id, is_creator")
        .eq("challenge_id", challengeId)
        .is("user_id", null)
        .limit(1);

      guestParticipant = ((participantRows as ParticipantRow[] | null) ?? [])[0] ?? null;
    }

    // Find each player's card
    const challengerCard =
      cards.find((c) => c.user_id === challenge.challenger_id) ?? null;
    const opponentCard = challenge.opponent_id
      ? cards.find((c) => c.user_id === challenge.opponent_id) ?? null
      : guestParticipant?.card_id
        ? cards.find((c) => c.id === guestParticipant!.card_id) ?? null
        : null;

    // Fetch picks for all cards in parallel (with prop + game details)
    const cardIds = cards.map((c) => c.id);
    let allPicks: PickRow[] = [];

    if (cardIds.length > 0) {

      const { data: picksData } = await (supabase.from("picks") as any)
        .select(
          "id, card_id, prop_id, selection, result, actual_value, prop:props!inner(id, player_name, player_team, stat_category, line, game:games!inner(home_team, away_team, commence_time))"
        )
        .in("card_id", cardIds);

      allPicks = (picksData as PickRow[] | null) ?? [];
    }

    // Build player side helper
    function buildPlayerSide(
      profile: ChallengeRow["challenger"] | null,
      card: CardRow | null,
      guest: ParticipantRow | null,
    ): AdminChallengePlayerSide {
      const cardPicks = card
        ? allPicks.filter((p) => p.card_id === card.id)
        : [];

      const isGuest = !profile;

      return {
        userId: profile?.id ?? null,
        username: profile?.username ?? "Guest",
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        email: guest?.email ?? null,
        isGuest,
        card: card
          ? {
              id: card.id,
              userId: card.user_id,
              username: null, // not needed; profile data is at the player side level
              displayName: null,
              status: card.status,
              score: card.score,
              totalPicks: card.total_picks,
              cardSize: card.card_size,
              gameMode: card.game_mode,
              challengeId: card.challenge_id,
              lockedAt: card.locked_at,
              resolvedAt: card.resolved_at,
              createdAt: card.created_at,
              picks: mapPicksToDetail(cardPicks),
            }
          : null,
      };
    }

    // For group challenges, build a participants[] array. Each participant
    // gets their card resolved by user_id (or by card_id for guests).
    const participants: AdminChallengePlayerSide[] =
      lobbyType === "group"
        ? groupParticipants.map((p) => {
            const card = p.user_id
              ? cards.find((c) => c.user_id === p.user_id) ?? null
              : p.card_id
                ? cards.find((c) => c.id === p.card_id) ?? null
                : null;
            return buildPlayerSide(p.user, card, p);
          })
        : [];

    const result: AdminChallengeDetail = {
      id: challenge.id,
      status: challenge.status as AdminChallengeDetail["status"],
      gameMode: challenge.game_mode,
      cardSize: challenge.card_size,
      message: challenge.message,
      winnerId: challenge.winner_id,
      createdAt: challenge.created_at,
      resolvedAt: challenge.resolved_at,
      lobbyType,
      challenger: buildPlayerSide(challenge.challenger, challengerCard, null),
      opponent:
        lobbyType === "group"
          ? null
          : challenge.opponent
            ? buildPlayerSide(challenge.opponent, opponentCard, null)
            : buildPlayerSide(null, opponentCard, guestParticipant),
      participants,
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch challenge detail");
  }
}
