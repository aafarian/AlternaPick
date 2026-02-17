import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, notFound, handleApiError } from "@/lib/api/errors";
import {
  buildLivePicksForCard,
  fetchLiveMaps,
  type PickWithPropAndGame,
} from "@/lib/cards/live-computation";
import type { LiveCardData } from "@/lib/cards/live-types";
import { tryResolveFromLiveData } from "@/lib/cards/resolution";

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

    // --- Resolution ---
    let cardResolved = false;

    if (card.status === "locked") {
      // Try the standard pipeline first (handles leaderboard, notifications, achievements)
      try {
        await tryResolveFromLiveData([card], gameStatusMap, boxscoreMap);
      } catch (err) {
        console.error("Auto-resolution from single card live endpoint failed:", err);
      }

      // Direct fallback: if live computation shows all picks are done, write to DB
      const allDone = livePicks.length > 0 && livePicks.every(
        (p) => p.trending !== null && p.game_status?.status === "final"
      );

      if (allDone) {
        const admin = createAdminClient();

        // Check DB — card may already have been resolved above
        const { data: check } = await (admin.from("cards") as any)
          .select("status")
          .eq("id", card.id)
          .single();

        if (check?.status === "locked") {
          const score = livePicks.filter((p) => p.trending === "hit").length;

          for (const lp of livePicks) {
            await (admin.from("picks") as any)
              .update({ result: lp.trending, actual_value: lp.current_value })
              .eq("id", lp.pick_id);
          }

          await (admin.from("cards") as any)
            .update({ status: "resolved", score, resolved_at: new Date().toISOString() })
            .eq("id", card.id)
            .eq("status", "locked");

          cardResolved = true;
        } else if (check?.status === "resolved") {
          cardResolved = true;
        }
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
