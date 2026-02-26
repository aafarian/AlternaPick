import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, notFound, handleApiError } from "@/lib/api/errors";
import {
  buildLivePicksForCard,
  fetchLiveMaps,
  type PickWithPropAndGame,
} from "@/lib/cards/live-computation";
import type { LiveCardData } from "@/lib/cards/live-types";
import { tryResolveFromLiveData } from "@/lib/cards/resolution";
import { logError } from "@/lib/logger";

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
        "id, status, picks(id, selection, result, actual_value, props(player_name, player_id, player_team, player_position, stat_category, line, game_id, games(external_event_id, sport, status, home_team, away_team, home_score, away_score, commence_time)))"
      )
      .eq("id", id)
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

    // --- Resolution ---
    // tryResolveFromLiveData handles the full pipeline: persist picks, update
    // leaderboard, send notifications, check achievements, and resolve challenges.
    // persistResolution has a direct-write fallback if the RPC fails.
    let cardResolved = false;

    if (card.status === "locked") {
      try {
        const results = await tryResolveFromLiveData([card], gameStatusMap, boxscoreMap);
        cardResolved = results.some((r) => r.card_id === card.id);
      } catch (err) {
        logError("resolution", `Auto-resolution from live endpoint failed: ${err instanceof Error ? err.message : err}`, `/api/cards/${id}/live`);
      }
    }

    const response: LiveCardData = {
      card_id: card.id,
      picks: livePicks,
      has_live_games: hasLiveGames,
      games,
      card_resolved: cardResolved || undefined,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-cache, max-age=0, stale-while-revalidate=15" },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch live stats");
  }
}
