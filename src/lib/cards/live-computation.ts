import { extractStatValue, fuzzyMatchPlayer } from "@/lib/cards/resolution";
import {
  fetchBoxscore,
  fetchBoxscoreLive,
  fetchTodaysGamesLive,
  fetchSoccerBoxscore,
  fetchSoccerBoxscoreLive,
  fetchSoccerGamesLive,
  fetchNcaabBoxscore,
  fetchNcaabBoxscoreLive,
  fetchNcaabGamesLive,
  type PlayerBoxScore,
  type StatsGame,
} from "@/lib/stats-service/client";
import type { StatCategory, PickSelection } from "@/lib/supabase/types";
import { registerNcaabTeamIds } from "@/lib/constants";
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
      sport?: string | null;
      status?: string | null;
      home_team?: string | null;
      away_team?: string | null;
      home_score?: number | null;
      away_score?: number | null;
      commence_time?: string | null;
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
        commence_time: gameInfo.start_time || pick.props.games?.commence_time || null,
      };

      if (gameInfo.status === "live") {
        liveGamesSet.add(nbaGameId);
      }
    } else {
      // Not in today's stats service or nba_game_id not yet set.
      // Use DB status/scores when available; only default to "final" for
      // games that are definitely past (nba_game_id was set but not in today's list).
      const dbStatus = (dbGameStatus as "scheduled" | "live" | "final") ?? "scheduled";
      const fallbackStatus = nbaGameId ? "final" : dbStatus;
      gameStatus = {
        game_id: pick.props.game_id,
        nba_game_id: nbaGameId ?? pick.props.game_id,
        status: fallbackStatus,
        period: fallbackStatus === "final" ? 4 : 0,
        clock: fallbackStatus === "final" ? "0:00" : "",
        home_team: pick.props.games?.home_team ?? "",
        away_team: pick.props.games?.away_team ?? "",
        home_tricode: "",
        away_tricode: "",
        home_score: pick.props.games?.home_score ?? 0,
        away_score: pick.props.games?.away_score ?? 0,
        commence_time: pick.props.games?.commence_time || null,
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
      sport: pick.props.games?.sport ?? undefined,
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
 * Fetches live game statuses and boxscores for today's games.
 * Returns gameStatusMap and boxscoreMap ready for buildLivePicksForCard().
 *
 * Strategy:
 * 1. Collect all nba_game_ids from picks
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
  // Collect game IDs that need live data, grouped by sport.
  // Include "final" games — they may have ended today and still have
  // boxscores available. The todayIds filter below ensures we only
  // fetch boxscores for games in today's schedule (skips stale games).
  const nbaCandidateIds = new Set<string>();
  const soccerCandidateIds = new Set<string>();
  const ncaabCandidateIds = new Set<string>();
  for (const pick of picks) {
    const nbaId = pick.props?.games?.nba_game_id;
    if (nbaId) {
      const sport = pick.props?.games?.sport;
      if (sport === "epl") {
        soccerCandidateIds.add(nbaId);
      } else if (sport === "ncaab") {
        ncaabCandidateIds.add(nbaId);
      } else {
        nbaCandidateIds.add(nbaId);
      }
    }
  }

  const gameStatusMap = new Map<string, StatsGame>();
  const boxscoreMap = new Map<string, PlayerBoxScore[]>();

  if (nbaCandidateIds.size === 0 && soccerCandidateIds.size === 0 && ncaabCandidateIds.size === 0) {
    return { gameStatusMap, boxscoreMap };
  }

  // Step 1: Fetch today's games (fast, cached) for all sports
  const [nbaGames, soccerGames, ncaabGames] = await Promise.all([
    nbaCandidateIds.size > 0
      ? fetchTodaysGamesLive().catch(() => [] as StatsGame[])
      : Promise.resolve([] as StatsGame[]),
    soccerCandidateIds.size > 0
      ? fetchSoccerGamesLive().catch(() => [] as StatsGame[])
      : Promise.resolve([] as StatsGame[]),
    ncaabCandidateIds.size > 0
      ? fetchNcaabGamesLive().catch(() => [] as StatsGame[])
      : Promise.resolve([] as StatsGame[]),
  ]);

  for (const g of nbaGames) {
    gameStatusMap.set(g.game_id, g);
  }
  for (const g of soccerGames) {
    gameStatusMap.set(g.game_id, g);
  }
  for (const g of ncaabGames) {
    gameStatusMap.set(g.game_id, g);
  }

  // Register NCAAB team IDs for logo rendering
  if (ncaabGames.length > 0) {
    registerNcaabTeamIds(
      ncaabGames.flatMap((g) => [
        { name: g.home_team, id: g.home_team_id ?? "" },
        { name: g.away_team, id: g.away_team_id ?? "" },
      ])
    );
  }

  // Step 2: Only fetch boxscores for games that are in today's schedule
  const fetches: Promise<void>[] = [];

  // NBA boxscores
  const nbaTodayIds = Array.from(nbaCandidateIds).filter((id) => gameStatusMap.has(id));
  const nbaLiveIds = nbaTodayIds.filter((id) => gameStatusMap.get(id)?.status === "live");
  const nbaFinalIds = nbaTodayIds.filter((id) => gameStatusMap.get(id)?.status === "final");

  if (nbaLiveIds.length > 0) {
    fetches.push(
      Promise.all(
        nbaLiveIds.map((gid) => fetchBoxscoreLive(gid).catch(() => [] as PlayerBoxScore[]))
      ).then((results) => {
        for (let i = 0; i < nbaLiveIds.length; i++) {
          boxscoreMap.set(nbaLiveIds[i], results[i]);
        }
      })
    );
  }
  if (nbaFinalIds.length > 0) {
    fetches.push(
      Promise.all(
        nbaFinalIds.map((gid) => fetchBoxscore(gid).catch(() => [] as PlayerBoxScore[]))
      ).then((results) => {
        for (let i = 0; i < nbaFinalIds.length; i++) {
          boxscoreMap.set(nbaFinalIds[i], results[i]);
        }
      })
    );
  }

  // Soccer boxscores
  const soccerTodayIds = Array.from(soccerCandidateIds).filter((id) => gameStatusMap.has(id));
  const soccerLiveIds = soccerTodayIds.filter((id) => gameStatusMap.get(id)?.status === "live");
  const soccerFinalIds = soccerTodayIds.filter((id) => gameStatusMap.get(id)?.status === "final");

  if (soccerLiveIds.length > 0) {
    fetches.push(
      Promise.all(
        soccerLiveIds.map((gid) => fetchSoccerBoxscoreLive(gid).catch(() => [] as PlayerBoxScore[]))
      ).then((results) => {
        for (let i = 0; i < soccerLiveIds.length; i++) {
          boxscoreMap.set(soccerLiveIds[i], results[i]);
        }
      })
    );
  }
  if (soccerFinalIds.length > 0) {
    fetches.push(
      Promise.all(
        soccerFinalIds.map((gid) => fetchSoccerBoxscore(gid).catch(() => [] as PlayerBoxScore[]))
      ).then((results) => {
        for (let i = 0; i < soccerFinalIds.length; i++) {
          boxscoreMap.set(soccerFinalIds[i], results[i]);
        }
      })
    );
  }

  // NCAAB boxscores
  const ncaabTodayIds = Array.from(ncaabCandidateIds).filter((id) => gameStatusMap.has(id));
  const ncaabLiveIds = ncaabTodayIds.filter((id) => gameStatusMap.get(id)?.status === "live");
  const ncaabFinalIds = ncaabTodayIds.filter((id) => gameStatusMap.get(id)?.status === "final");

  if (ncaabLiveIds.length > 0) {
    fetches.push(
      Promise.all(
        ncaabLiveIds.map((gid) => fetchNcaabBoxscoreLive(gid).catch(() => [] as PlayerBoxScore[]))
      ).then((results) => {
        for (let i = 0; i < ncaabLiveIds.length; i++) {
          boxscoreMap.set(ncaabLiveIds[i], results[i]);
        }
      })
    );
  }
  if (ncaabFinalIds.length > 0) {
    fetches.push(
      Promise.all(
        ncaabFinalIds.map((gid) => fetchNcaabBoxscore(gid).catch(() => [] as PlayerBoxScore[]))
      ).then((results) => {
        for (let i = 0; i < ncaabFinalIds.length; i++) {
          boxscoreMap.set(ncaabFinalIds[i], results[i]);
        }
      })
    );
  }

  await Promise.all(fetches);

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
