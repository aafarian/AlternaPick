import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, notFound, forbidden, badRequest, handleApiError } from "@/lib/api/errors";
import type { CardDetailResponse, CardDetailPick } from "@/lib/cards/detail-types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

interface PickRow {
  id: string;
  prop_id: string;
  selection: string;
  result: string;
  actual_value: number | null;
  props: {
    player_name: string;
    player_team: string | null;
    stat_category: string;
    line: number;
    games: {
      home_team: string;
      away_team: string;
      commence_time: string;
      sport: string | null;
    } | null;
  } | null;
}

interface CardRow {
  id: string;
  user_id: string;
  status: string;
  score: number;
  total_picks: number;
  card_size: number;
  game_mode: string;
  locked_at: string | null;
  resolved_at: string | null;
  created_at: string;
  picks: PickRow[];
}

/**
 * GET /api/cards/[id]
 *
 * Returns full card detail including picks, props, and game info for the
 * authenticated owner of the card. Used by the analytics card history modal
 * to lazy-load card details on expand.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const { id } = await context.params;

    if (!UUID_RE.test(id)) {
      return badRequest("Invalid card ID format");
    }

    const { data, error } = await (supabase.from("cards") as any)
      .select(
        "id, user_id, status, score, total_picks, card_size, game_mode, locked_at, resolved_at, created_at, picks(id, prop_id, selection, result, actual_value, props(player_name, player_team, stat_category, line, games(home_team, away_team, commence_time, sport)))"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return notFound("Card");
    }

    const card = data as CardRow;

    if (card.user_id !== user.id) {
      return forbidden("This card does not belong to you");
    }

    const picks: CardDetailPick[] = (card.picks ?? []).map((p) => ({
      id: p.id,
      propId: p.prop_id,
      playerName: p.props?.player_name ?? "Unknown",
      playerTeam: p.props?.player_team ?? null,
      statCategory: p.props?.stat_category ?? "",
      line: p.props?.line ?? 0,
      selection: p.selection,
      result: p.result,
      actualValue: p.actual_value,
      homeTeam: p.props?.games?.home_team ?? null,
      awayTeam: p.props?.games?.away_team ?? null,
      commenceTime: p.props?.games?.commence_time ?? null,
      sport: p.props?.games?.sport ?? null,
    }));

    const response: CardDetailResponse = {
      id: card.id,
      status: card.status,
      score: card.score,
      totalPicks: card.total_picks,
      cardSize: card.card_size,
      gameMode: card.game_mode,
      lockedAt: card.locked_at,
      resolvedAt: card.resolved_at,
      createdAt: card.created_at,
      picks,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch card detail");
  }
}
