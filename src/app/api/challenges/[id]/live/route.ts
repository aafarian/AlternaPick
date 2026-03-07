import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, notFound, handleApiError } from "@/lib/api/errors";
import {
  buildLivePicksForCard,
  fetchLiveMapsForCards,
  syncGameStatusToDb,
  type PickWithPropAndGame,
} from "@/lib/cards/live-computation";
import type {
  LiveGameStatus,
  LiveChallengeData,
} from "@/lib/cards/live-types";
import { tryResolveFromLiveData } from "@/lib/cards/resolution";
import { resolveEligibleChallenges } from "@/lib/challenges/resolution";
import { logError } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

interface ChallengeCard {
  id: string;
  user_id: string | null;
  status: string;
  score: number;
  total_picks: number;
  picks: PickWithPropAndGame[];
}

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

    // Verify user is a participant
    const { data: challenge, error: challengeError } = await (supabase.from("challenges") as any)
      .select("id, challenger_id, opponent_id, status")
      .eq("id", id)
      .single();

    if (challengeError || !challenge) {
      return notFound("Challenge");
    }

    if (challenge.challenger_id !== user.id && challenge.opponent_id !== user.id) {
      return notFound("Challenge");
    }

    // Fetch both players' cards using admin client (bypass RLS for opponent's card)
    const admin = createAdminClient();
    const { data: cards } = await (admin.from("cards") as any)
      .select(
        "id, user_id, status, score, total_picks, picks(id, selection, result, actual_value, props(player_name, player_id, player_team, player_position, stat_category, line, game_id, games(external_event_id, sport, status, home_team, away_team, home_score, away_score, period, clock, commence_time)))"
      )
      .eq("challenge_id", id);

    const cardsList = (cards ?? []) as ChallengeCard[];

    // Fetch live data — only for today's games, skips stale games
    const { gameStatusMap, boxscoreMap } = await fetchLiveMapsForCards(cardsList);

    const challengerCardRaw = cardsList.find((c) => c.user_id === challenge.challenger_id) ?? null;
    const opponentCardRaw = cardsList.find((c) => c.user_id === challenge.opponent_id) ?? null;

    const challengerLive = challengerCardRaw
      ? buildLivePicksForCard(challengerCardRaw.picks, gameStatusMap, boxscoreMap)
      : null;

    const opponentLive = opponentCardRaw
      ? buildLivePicksForCard(opponentCardRaw.picks, gameStatusMap, boxscoreMap)
      : null;

    // Write-through: update DB with fresh ESPN data (non-critical, don't block)
    const allPicks = cardsList.flatMap((c) => c.picks);
    syncGameStatusToDb(admin, gameStatusMap, allPicks).catch((err) => {
      logError("live-sync", `Write-through sync failed: ${err instanceof Error ? err.message : err}`, `/api/challenges/${id}/live`);
    });

    // --- Resolution ---
    // tryResolveFromLiveData handles the full pipeline: persist picks, update
    // leaderboard, send notifications, check achievements, and internally calls
    // resolveEligibleChallenges when cards are resolved.
    let challengeResolved = false;

    if (cardsList.some((c) => c.status === "locked")) {
      try {
        await tryResolveFromLiveData(cardsList, gameStatusMap, boxscoreMap);
      } catch (err) {
        logError("resolution", `tryResolveFromLiveData failed: ${err instanceof Error ? err.message : err}`, `/api/challenges/${id}/live`);
      }
    }

    // Safety net: resolve the challenge even if cards were already resolved
    // by cron (tryResolveFromLiveData only calls resolveEligibleChallenges
    // when it resolves cards itself — this covers the gap).
    if (challenge.status === "active") {
      try {
        const results = await resolveEligibleChallenges();
        challengeResolved = results.some((r) => r.challenge_id === id);
      } catch (err) {
        logError("resolution", `resolveEligibleChallenges failed: ${err instanceof Error ? err.message : err}`, `/api/challenges/${id}/live`);
      }
    }

    // --- Build response ---
    const seenGames = new Set<string>();
    const games: LiveGameStatus[] = [];
    for (const result of [challengerLive, opponentLive]) {
      if (!result) continue;
      for (const g of result.games) {
        if (!seenGames.has(g.external_event_id)) {
          seenGames.add(g.external_event_id);
          games.push(g);
        }
      }
    }

    const response: LiveChallengeData = {
      challenge_id: id,
      challenger_card: challengerLive
        ? {
            card_id: challengerCardRaw!.id,
            picks: challengerLive.livePicks,
            has_live_games: challengerLive.hasLiveGames,
          }
        : null,
      opponent_card: opponentLive
        ? {
            card_id: opponentCardRaw!.id,
            picks: opponentLive.livePicks,
            has_live_games: opponentLive.hasLiveGames,
          }
        : null,
      games,
      has_live_games: (challengerLive?.hasLiveGames || opponentLive?.hasLiveGames) ?? false,
      challenge_resolved: challengeResolved || undefined,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch live challenge stats");
  }
}
