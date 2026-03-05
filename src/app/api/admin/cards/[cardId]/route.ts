import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, badRequest, handleApiError } from "@/lib/api/errors";
import type { AdminCardDetail, AdminCardPickDetail } from "@/lib/admin/types";
import type {
  CardStatus,
  ChallengeStatus,
  GameMode,
  PickResult,
  PickSelection,
  StatCategory,
} from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Row types for query results
// ---------------------------------------------------------------------------

type CardRow = {
  id: string;
  user_id: string | null;
  challenge_id: string | null;
  status: CardStatus;
  score: number;
  total_picks: number;
  card_size: number;
  game_mode: GameMode;
  locked_at: string | null;
  resolved_at: string | null;
  created_at: string;
  profile: {
    username: string;
    display_name: string | null;
  } | null;
};

type PickRow = {
  id: string;
  prop_id: string;
  selection: PickSelection;
  result: PickResult;
  actual_value: number | null;
  prop: {
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

type ChallengeRow = {
  id: string;
  status: ChallengeStatus;
  challenger_id: string;
  opponent_id: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/cards/:cardId
 * Returns comprehensive card detail including owner profile, all picks with
 * prop/game details, and challenge info if applicable.
 *
 * Requires admin access; returns 404 for non-admin or unauthenticated users
 * so the endpoint is not discoverable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return auth.response;
    }

    const { cardId } = await params;

    if (!UUID_RE.test(cardId)) {
      return badRequest("Invalid card ID format");
    }

    const supabase = createAdminClient();

    // Fetch card with owner profile joined via user_id → profiles
     
    const { data: cardData, error: cardError } = await (
      supabase.from("cards") as any
    )
      .select(
        "id, user_id, challenge_id, status, score, total_picks, card_size, game_mode, locked_at, resolved_at, created_at, profile:profiles!cards_user_id_fkey(username, display_name)"
      )
      .eq("id", cardId)
      .single();

    if (cardError || !cardData) {
      return notFound("Card");
    }

    const card = cardData as CardRow;

    // Fetch all picks for this card with prop and game details
     
    const { data: picksData } = await (supabase.from("picks") as any)
      .select(
        "id, prop_id, selection, result, actual_value, prop:props!inner(player_name, player_team, stat_category, line, game:games!inner(home_team, away_team, commence_time))"
      )
      .eq("card_id", cardId);

    const picks = (picksData as PickRow[] | null) ?? [];

    // If card belongs to a challenge, fetch basic challenge info
    let challengeInfo: {
      id: string;
      status: ChallengeStatus;
      opponentId: string;
    } | null = null;

    if (card.challenge_id) {
       
      const { data: challengeData } = await (
        supabase.from("challenges") as any
      )
        .select("id, status, challenger_id, opponent_id")
        .eq("id", card.challenge_id)
        .single();

      if (challengeData) {
        const ch = challengeData as ChallengeRow;
        // Determine the opponent relative to the card owner
        const opponentId =
          ch.challenger_id === card.user_id
            ? ch.opponent_id
            : ch.challenger_id;
        challengeInfo = {
          id: ch.id,
          status: ch.status,
          opponentId,
        };
      }
    }

    // Map picks to camelCase AdminCardPickDetail
    const mappedPicks: AdminCardPickDetail[] = picks.map((pick) => ({
      id: pick.id,
      propId: pick.prop_id,
      playerName: pick.prop.player_name,
      playerTeam: pick.prop.player_team,
      statCategory: pick.prop.stat_category,
      line: pick.prop.line,
      selection: pick.selection,
      result: pick.result,
      actualValue: pick.actual_value,
      homeTeam: pick.prop.game.home_team,
      awayTeam: pick.prop.game.away_team,
      commenceTime: pick.prop.game.commence_time,
    }));

    const result: AdminCardDetail = {
      id: card.id,
      userId: card.user_id,
      username: card.profile?.username ?? null,
      displayName: card.profile?.display_name ?? null,
      status: card.status,
      score: card.score,
      totalPicks: card.total_picks,
      cardSize: card.card_size,
      gameMode: card.game_mode,
      challengeId: card.challenge_id,
      lockedAt: card.locked_at,
      resolvedAt: card.resolved_at,
      createdAt: card.created_at,
      picks: mappedPicks,
    };

    return NextResponse.json(
      { ...result, challenge: challengeInfo },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      }
    );
  } catch (error) {
    return handleApiError(error, "Failed to fetch card detail");
  }
}
