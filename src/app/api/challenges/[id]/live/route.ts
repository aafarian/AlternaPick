import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, notFound, handleApiError } from "@/lib/api/errors";
import {
  buildLivePicksForCard,
  fetchLiveMapsForCards,
  type PickWithPropAndGame,
} from "@/lib/cards/live-computation";
import type {
  LiveGameStatus,
  LiveChallengeData,
} from "@/lib/cards/live-types";
import { tryResolveFromLiveData } from "@/lib/cards/resolution";

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
    // Include result, actual_value, and DB game status for fallback
    const admin = createAdminClient();
    const { data: cards } = await (admin.from("cards") as any)
      .select(
        "id, user_id, status, score, total_picks, picks(id, selection, result, actual_value, props(player_name, player_id, player_team, player_position, stat_category, line, game_id, games(external_event_id, sport, status, home_team, away_team, home_score, away_score, commence_time)))"
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

    // --- Resolution ---
    const hadLockedCards = cardsList.some((c) => c.status === "locked");
    let challengeResolved = false;

    if (hadLockedCards) {
      // Try the standard pipeline first (handles leaderboard, notifications, achievements)
      try {
        await tryResolveFromLiveData(cardsList, gameStatusMap, boxscoreMap);
      } catch (err) {
        console.error("tryResolveFromLiveData failed:", err);
      }

      // Direct fallback: if live computation already shows all picks are done,
      // just write the results to DB. This catches whatever the pipeline misses
      // (yesterday's games, RPC issues, missing ESPN IDs, etc.)
      for (const [cardRaw, live] of [
        [challengerCardRaw, challengerLive] as const,
        [opponentCardRaw, opponentLive] as const,
      ]) {
        if (!cardRaw || cardRaw.status !== "locked") continue;
        const livePicks = live?.livePicks;
        if (!livePicks?.length) continue;

        // Every pick must have a result and its game must be final
        const allDone = livePicks.every(
          (p) => p.trending !== null && p.game_status?.status === "final"
        );
        if (!allDone) continue;

        // Check DB — card may already have been resolved by tryResolveFromLiveData
        const { data: check } = await (admin.from("cards") as any)
          .select("status")
          .eq("id", cardRaw.id)
          .single();
        if (check?.status !== "locked") continue;

        const score = livePicks.filter((p) => p.trending === "hit").length;

        // Write pick results directly
        for (const lp of livePicks) {
          await (admin.from("picks") as any)
            .update({ result: lp.trending, actual_value: lp.current_value })
            .eq("id", lp.pick_id);
        }

        // Mark card resolved
        await (admin.from("cards") as any)
          .update({ status: "resolved", score, resolved_at: new Date().toISOString() })
          .eq("id", cardRaw.id)
          .eq("status", "locked");
      }

      // Check if all cards are now resolved → resolve the challenge
      const { data: freshCards } = await (admin.from("cards") as any)
        .select("user_id, score, status")
        .eq("challenge_id", id);

      const allCardsResolved = (freshCards ?? []).length >= 2 &&
        freshCards.every((c: { status: string }) => c.status === "resolved");

      if (allCardsResolved) {
        challengeResolved = true;

        // Resolve the challenge itself if still active
        if (challenge.status === "active") {
          const cCard = freshCards.find(
            (c: { user_id: string }) => c.user_id === challenge.challenger_id
          );
          const oCard = freshCards.find(
            (c: { user_id: string }) => c.user_id === challenge.opponent_id
          );
          if (cCard && oCard) {
            let winnerId: string | null = null;
            if (cCard.score > oCard.score) winnerId = challenge.challenger_id;
            else if (oCard.score > cCard.score) winnerId = challenge.opponent_id;

            await (admin.from("challenges") as any)
              .update({
                status: "resolved",
                winner_id: winnerId,
                resolved_at: new Date().toISOString(),
              })
              .eq("id", id)
              .eq("status", "active");
          }
        }
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
