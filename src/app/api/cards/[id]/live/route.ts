import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, notFound, handleApiError } from "@/lib/api/errors";
import {
  buildLivePicksForCard,
  fetchLiveMaps,
  type PickWithPropAndGame,
} from "@/lib/cards/live-computation";
import type { LiveCardData } from "@/lib/cards/live-types";

type RouteContext = { params: Promise<{ id: string }> };

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

    // Fetch card with picks, props, and game data (including DB status for fallback)
    const cardResult = await (supabase.from("cards") as any)
      .select(
        "id, status, picks(id, selection, result, actual_value, props(player_name, player_id, stat_category, line, game_id, games(nba_game_id, status, home_team, away_team, home_score, away_score)))"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (cardResult.error || !cardResult.data) {
      return notFound("Card");
    }

    const card = cardResult.data as {
      id: string;
      status: string;
      picks: PickWithPropAndGame[];
    };

    const { gameStatusMap, boxscoreMap } = await fetchLiveMaps(card.picks);

    const { livePicks, games, hasLiveGames } = buildLivePicksForCard(
      card.picks,
      gameStatusMap,
      boxscoreMap,
    );

    const response: LiveCardData = {
      card_id: card.id,
      picks: livePicks,
      has_live_games: hasLiveGames,
      games,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch live stats");
  }
}
