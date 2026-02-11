import { extractStatValue, fuzzyMatchPlayer } from "@/lib/cards/resolution";
import {
  fetchBoxscoreLive,
  fetchTodaysGamesLive,
  type PlayerBoxScore,
  type StatsGame,
} from "@/lib/stats-service/client";
import type { StatCategory, PickSelection } from "@/lib/supabase/types";
import type {
  LivePickData,
  LiveGameStatus,
} from "@/lib/cards/live-types";

export interface PickWithPropAndGame {
  id: string;
  selection: PickSelection;
  result?: string;
  actual_value?: number | null;
  props: {
    player_name: string;
    player_id: string | null;
    stat_category: StatCategory;
    line: number;
    game_id: string;
    games: {
      nba_game_id: string | null;
      status?: string | null;
      home_team?: string | null;
      away_team?: string | null;
      home_score?: number | null;
      away_score?: number | null;
    };
  };
}

export function buildLivePicksForCard(
  picks: PickWithPropAndGame[],
  gameStatusMap: Map<string, StatsGame>,
  boxscoreMap: Map<string, PlayerBoxScore[]>,
): { livePicks: LivePickData[]; games: LiveGameStatus[]; hasLiveGames: boolean } {
  const liveGamesSet = new Set<string>();
  const livePicks: LivePickData[] = [];

  for (const pick of picks) {
    const nbaGameId = pick.props?.games?.nba_game_id;
    const gameInfo = nbaGameId ? gameStatusMap.get(nbaGameId) : null;
    const dbGameStatus = pick.props?.games?.status;

    let gameStatus: LiveGameStatus | null = null;
    if (gameInfo && nbaGameId) {
      // Stats service has this game (today's game) — use live data
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
    } else {
      // Not in today's stats service → past game or untracked.
      // Today's games (even scheduled ones) are returned by fetchTodaysGamesLive(),
      // so anything missing from gameStatusMap is definitively not playing today.
      gameStatus = {
        game_id: pick.props.game_id,
        nba_game_id: nbaGameId ?? pick.props.game_id,
        status: "final",
        period: 4,
        clock: "0:00",
        home_team: pick.props.games?.home_team ?? "",
        away_team: pick.props.games?.away_team ?? "",
        home_tricode: "",
        away_tricode: "",
        home_score: pick.props.games?.home_score ?? 0,
        away_score: pick.props.games?.away_score ?? 0,
      };
    }

    let currentValue: number | null = null;
    let trending: "hit" | "miss" | "push" | null = null;

    // Use the live status when available, otherwise fall back to the gameStatus we computed
    const effectiveStatus = gameInfo?.status ?? gameStatus?.status ?? dbGameStatus;

    if (effectiveStatus === "live" || effectiveStatus === "final") {
      // Try boxscore first (only for today's games with nba_game_id)
      if (nbaGameId) {
        const boxscore = boxscoreMap.get(nbaGameId) ?? [];
        const playerStats = fuzzyMatchPlayer(boxscore, pick.props.player_name);

        if (playerStats) {
          currentValue = extractStatValue(playerStats, pick.props.stat_category);

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

      // Fallback: use resolved pick data when boxscore unavailable
      if (currentValue === null && pick.actual_value != null) {
        currentValue = pick.actual_value;
        trending =
          pick.result === "hit" || pick.result === "miss" || pick.result === "push"
            ? (pick.result as "hit" | "miss" | "push")
            : null;
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

  return {
    livePicks,
    games,
    hasLiveGames: liveGamesSet.size > 0,
  };
}

/**
 * Fetches live game statuses and boxscores, skipping stale/final games.
 * Returns gameStatusMap and boxscoreMap ready for buildLivePicksForCard().
 *
 * Strategy:
 * 1. Collect nba_game_ids that are NOT "final" in DB
 * 2. Fetch today's games first (fast, 30s cached)
 * 3. Only fetch boxscores for games that are in today's schedule
 *    (skips yesterday's stale games that would timeout)
 */
export async function fetchLiveMaps(
  picks: PickWithPropAndGame[],
): Promise<{
  gameStatusMap: Map<string, StatsGame>;
  boxscoreMap: Map<string, PlayerBoxScore[]>;
}> {
  // Collect nba_game_ids that need live data (not final in DB)
  const candidateIds = new Set<string>();
  for (const pick of picks) {
    const nbaId = pick.props?.games?.nba_game_id;
    const dbStatus = pick.props?.games?.status;
    if (nbaId && dbStatus !== "final") {
      candidateIds.add(nbaId);
    }
  }

  const gameStatusMap = new Map<string, StatsGame>();
  const boxscoreMap = new Map<string, PlayerBoxScore[]>();

  if (candidateIds.size === 0) {
    return { gameStatusMap, boxscoreMap };
  }

  // Step 1: Fetch today's games (fast, cached)
  const todaysGames = await fetchTodaysGamesLive().catch(() => [] as StatsGame[]);
  for (const g of todaysGames) {
    gameStatusMap.set(g.game_id, g);
  }

  // Step 2: Only fetch boxscores for games that are in today's schedule
  const todayIds = Array.from(candidateIds).filter((id) => gameStatusMap.has(id));

  if (todayIds.length > 0) {
    const results = await Promise.all(
      todayIds.map((gid) => fetchBoxscoreLive(gid).catch(() => [] as PlayerBoxScore[]))
    );
    for (let i = 0; i < todayIds.length; i++) {
      boxscoreMap.set(todayIds[i], results[i]);
    }
  }

  return { gameStatusMap, boxscoreMap };
}

/**
 * Same as fetchLiveMaps but for multiple cards (deduplicates game IDs).
 */
export async function fetchLiveMapsForCards(
  cards: { picks: PickWithPropAndGame[] }[],
): Promise<{
  gameStatusMap: Map<string, StatsGame>;
  boxscoreMap: Map<string, PlayerBoxScore[]>;
}> {
  const allPicks = cards.flatMap((c) => c.picks);
  return fetchLiveMaps(allPicks);
}
