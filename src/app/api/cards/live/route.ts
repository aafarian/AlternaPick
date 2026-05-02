import { after } from "next/server";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import {
  buildLivePicksForCard,
  fetchLiveMapsForCards,
  syncGameStatusToDb,
  type PickWithPropAndGame,
} from "@/lib/cards/live-computation";
import type { LiveCardData } from "@/lib/cards/live-types";
import { tryResolveFromLiveData } from "@/lib/cards/resolution";
import { logError } from "@/lib/logger";

interface CardWithPicks {
  id: string;
  status: string;
  picks: PickWithPropAndGame[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    if (!idsParam) {
      return badRequest("ids query parameter is required");
    }

    const cardIds = idsParam.split(",").filter(Boolean);
    if (cardIds.length === 0) {
      return badRequest("At least one card id is required");
    }
    if (cardIds.length > 20) {
      return badRequest("Maximum 20 card ids per request");
    }

    // Single query for all cards — include result, actual_value, and DB game status
    const cardsResult = await (supabase.from("cards") as any)
      .select(
        "id, status, picks(id, selection, result, actual_value, notch, adjusted_line, props(player_name, player_id, player_team, player_position, stat_category, line, game_id, games(external_event_id, sport, status, home_team, away_team, home_score, away_score, period, clock, commence_time)))"
      )
      .in("id", cardIds)
      .eq("user_id", user.id);

    if (cardsResult.error) {
      return NextResponse.json(
        { error: "Failed to fetch cards", message: cardsResult.error.message },
        { status: 500 }
      );
    }

    const cards = (cardsResult.data ?? []) as CardWithPicks[];

    // Fetch live data — only for today's games, skips stale games
    const { gameStatusMap, boxscoreMap } = await fetchLiveMapsForCards(cards);

    // Build LiveCardData for each card using shared maps
    const result: Record<string, LiveCardData> = {};
    for (const card of cards) {
      const { livePicks, games, hasLiveGames, allGamesFinal } = buildLivePicksForCard(
        card.picks,
        gameStatusMap,
        boxscoreMap,
      );

      result[card.id] = {
        card_id: card.id,
        picks: livePicks,
        has_live_games: hasLiveGames,
        all_games_final: allGamesFinal,
        games,
      };
    }

    // Runs after response is sent so it doesn't block the user
    after(async () => {
      const allPicks = cards.flatMap((c) => c.picks);
      try {
        await syncGameStatusToDb(supabase, gameStatusMap, allPicks);
      } catch (err) {
        logError("live-sync", `Write-through sync failed: ${err instanceof Error ? err.message : err}`, "/api/cards/live");
      }
      try {
        await tryResolveFromLiveData(cards, gameStatusMap, boxscoreMap);
      } catch (err) {
        logError("resolution", `Auto-resolution from live endpoint failed: ${err instanceof Error ? err.message : err}`, "/api/cards/live");
      }
    });

    return NextResponse.json(
      { cards: result },
      { headers: { "Cache-Control": "no-cache, max-age=0, stale-while-revalidate=15" } },
    );
  } catch (error) {
    return handleApiError(error, "Failed to fetch batch live stats");
  }
}
