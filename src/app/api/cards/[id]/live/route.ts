import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, notFound, handleApiError } from "@/lib/api/errors";
import {
  fetchBoxscoreLive,
  fetchTodaysGamesLive,
  type PlayerBoxScore,
  type StatsGame,
} from "@/lib/stats-service/client";
import { extractStatValue, fuzzyMatchPlayer } from "@/lib/cards/resolution";
import type { StatCategory, PickSelection } from "@/lib/supabase/types";
import type {
  LiveCardData,
  LivePickData,
  LiveGameStatus,
} from "@/lib/cards/live-types";

type RouteContext = { params: Promise<{ id: string }> };

interface PickWithPropAndGame {
  id: string;
  selection: PickSelection;
  props: {
    player_name: string;
    player_id: string | null;
    stat_category: StatCategory;
    line: number;
    game_id: string;
    games: {
      nba_game_id: string | null;
    };
  };
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

    // Fetch card with picks, props, and game nba_game_id
    const cardResult = await (supabase.from("cards") as any)
      .select(
        "id, status, picks(id, selection, props(player_name, player_id, stat_category, line, game_id, games(nba_game_id)))"
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

    // Collect unique nba_game_ids
    const nbaGameIds = new Set<string>();
    for (const pick of card.picks) {
      const nbaId = pick.props?.games?.nba_game_id;
      if (nbaId) nbaGameIds.add(nbaId);
    }

    // Fetch live game statuses + boxscores in parallel
    const [todaysGames, ...boxscoreResults] = await Promise.all([
      fetchTodaysGamesLive().catch(() => [] as StatsGame[]),
      ...Array.from(nbaGameIds).map((gid) =>
        fetchBoxscoreLive(gid).catch(() => [] as PlayerBoxScore[])
      ),
    ]);

    // Build maps
    const gameStatusMap = new Map<string, StatsGame>();
    for (const g of todaysGames) {
      gameStatusMap.set(g.game_id, g);
    }

    const boxscoreMap = new Map<string, PlayerBoxScore[]>();
    const gameIdArr = Array.from(nbaGameIds);
    for (let i = 0; i < gameIdArr.length; i++) {
      boxscoreMap.set(gameIdArr[i], boxscoreResults[i]);
    }

    // Build live pick data
    const liveGamesSet = new Set<string>();
    const livePicks: LivePickData[] = [];

    for (const pick of card.picks) {
      const nbaGameId = pick.props?.games?.nba_game_id;
      const gameInfo = nbaGameId ? gameStatusMap.get(nbaGameId) : null;

      let gameStatus: LiveGameStatus | null = null;
      if (gameInfo && nbaGameId) {
        gameStatus = {
          game_id: pick.props.game_id,
          nba_game_id: nbaGameId,
          status: gameInfo.status as "scheduled" | "live" | "final",
          period: gameInfo.period,
          clock: gameInfo.clock,
          home_team: gameInfo.home_team,
          away_team: gameInfo.away_team,
          home_tricode: gameInfo.home_tricode,
          away_tricode: gameInfo.away_tricode,
          home_score: gameInfo.home_score,
          away_score: gameInfo.away_score,
        };

        if (gameInfo.status === "live") {
          liveGamesSet.add(nbaGameId);
        }
      }

      let currentValue: number | null = null;
      let trending: "hit" | "miss" | "push" | null = null;

      if (nbaGameId && (gameInfo?.status === "live" || gameInfo?.status === "final")) {
        const boxscore = boxscoreMap.get(nbaGameId) ?? [];
        const playerStats = fuzzyMatchPlayer(boxscore, pick.props.player_name);

        if (playerStats) {
          currentValue = extractStatValue(
            playerStats,
            pick.props.stat_category
          );

          if (currentValue === pick.props.line) {
            trending = "push";
          } else if (
            (pick.selection === "over" && currentValue > pick.props.line) ||
            (pick.selection === "under" && currentValue < pick.props.line)
          ) {
            trending = "hit";
          } else {
            trending = "miss";
          }
        }
      }

      livePicks.push({
        pick_id: pick.id,
        player_name: pick.props.player_name,
        player_id: pick.props.player_id,
        stat_category: pick.props.stat_category,
        line: pick.props.line,
        selection: pick.selection,
        current_value: currentValue,
        trending,
        game_status: gameStatus,
      });
    }

    // Build unique games list
    const seenGames = new Set<string>();
    const games: LiveGameStatus[] = [];
    for (const pick of livePicks) {
      if (pick.game_status && !seenGames.has(pick.game_status.nba_game_id)) {
        seenGames.add(pick.game_status.nba_game_id);
        games.push(pick.game_status);
      }
    }

    const response: LiveCardData = {
      card_id: card.id,
      picks: livePicks,
      has_live_games: liveGamesSet.size > 0,
      games,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, "Failed to fetch live stats");
  }
}
