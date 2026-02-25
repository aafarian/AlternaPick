import { extractStatValue, fuzzyMatchPlayer } from "@/lib/cards/resolution";
import {
  fetchBoxscore,
  fetchBoxscoreLive,
  fetchTodaysGamesLive,
  fetchSoccerBoxscore,
  fetchSoccerBoxscoreLive,
  fetchSoccerGamesLive,
  fetchLaLigaGamesLive,
  fetchNcaabBoxscore,
  fetchNcaabBoxscoreLive,
  fetchNcaabGamesLive,
  type PlayerBoxScore,
  type StatsGame,
} from "@/lib/stats-service/client";
import { logError } from "@/lib/logger";
import type { StatCategory, PickSelection } from "@/lib/supabase/types";
import { registerNcaabTeamIds, teamLogoUrl, teamTricode, gameUrl } from "@/lib/constants";
import type {
  LivePickData,
  LiveGameStatus,
} from "@/lib/cards/live-types";

/** Run async tasks with bounded concurrency (no external dependency). */
async function pMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

const BOXSCORE_CONCURRENCY = 3;

export interface PickWithPropAndGame {
  id: string;
  selection: PickSelection;
  result?: string;
  actual_value?: number | null;
  props: {
    player_name: string;
    player_id: string | null;
    player_team?: string | null;
    player_position?: string | null;
    stat_category: StatCategory;
    line: number;
    game_id: string;
    games: {
      external_event_id: string | null;
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

  // Build reverse lookup by team name for games without external_event_id
  const gamesByTeam = new Map<string, StatsGame>();
  for (const g of gameStatusMap.values()) {
    gamesByTeam.set(`${g.home_team}|${g.away_team}`.toLowerCase(), g);
  }

  for (const pick of picks) {
    const eventId = pick.props?.games?.external_event_id;
    let gameInfo = eventId ? gameStatusMap.get(eventId) : null;

    // Fallback: match by team names when external_event_id isn't set yet
    if (!gameInfo) {
      const home = pick.props?.games?.home_team?.toLowerCase() ?? "";
      const away = pick.props?.games?.away_team?.toLowerCase() ?? "";
      if (home && away) {
        gameInfo = gamesByTeam.get(`${home}|${away}`) ?? null;
      }
    }

    const dbGameStatus = pick.props?.games?.status;

    let gameStatus: LiveGameStatus | null = null;
    const resolvedEventId = eventId ?? gameInfo?.game_id ?? null;

    if (gameInfo) {
      // Stats service has this game (today's game) — use live data
      gameStatus = {
        game_id: pick.props.game_id,
        external_event_id: resolvedEventId ?? pick.props.game_id,
        status: gameInfo.status as "scheduled" | "live" | "final",
        period: gameInfo.period,
        clock: gameInfo.clock,
        sport: pick.props.games?.sport ?? undefined,
        home_team: gameInfo.home_team,
        away_team: gameInfo.away_team,
        home_tricode: gameInfo.home_tricode,
        away_tricode: gameInfo.away_tricode,
        home_score: gameInfo.home_score,
        away_score: gameInfo.away_score,
        home_logo: teamLogoUrl(gameInfo.home_team) || teamLogoUrl(gameInfo.home_tricode),
        away_logo: teamLogoUrl(gameInfo.away_team) || teamLogoUrl(gameInfo.away_tricode),
        commence_time: gameInfo.start_time || pick.props.games?.commence_time || null,
        game_url: gameUrl(pick.props.games?.sport ?? undefined, resolvedEventId ?? ""),
      };

      if (gameInfo.status === "live" && resolvedEventId) {
        liveGamesSet.add(resolvedEventId);
      }
    } else {
      // Not in today's stats service — use DB status.
      // Do NOT assume "final" just because the game has an external_event_id;
      // the stats service may not have returned it due to timezone mismatch
      // (Vercel UTC vs US evening games) or transient failures.
      const dbStatus = (dbGameStatus as "scheduled" | "live" | "final") ?? "scheduled";
      const dbHomeTeam = pick.props.games?.home_team ?? "";
      const dbAwayTeam = pick.props.games?.away_team ?? "";
      gameStatus = {
        game_id: pick.props.game_id,
        external_event_id: eventId ?? pick.props.game_id,
        status: dbStatus,
        period: dbStatus === "final" ? 4 : 0,
        clock: dbStatus === "final" ? "0:00" : "",
        sport: pick.props.games?.sport ?? undefined,
        home_team: dbHomeTeam,
        away_team: dbAwayTeam,
        home_tricode: teamTricode(dbHomeTeam),
        away_tricode: teamTricode(dbAwayTeam),
        home_score: pick.props.games?.home_score ?? 0,
        away_score: pick.props.games?.away_score ?? 0,
        home_logo: teamLogoUrl(dbHomeTeam) || teamLogoUrl(teamTricode(dbHomeTeam)),
        away_logo: teamLogoUrl(dbAwayTeam) || teamLogoUrl(teamTricode(dbAwayTeam)),
        commence_time: pick.props.games?.commence_time || null,
        game_url: gameUrl(pick.props.games?.sport ?? undefined, eventId ?? ""),
      };
    }

    let currentValue: number | null = null;
    let trending: "hit" | "miss" | "push" | null = null;

    // Use the live status when available, otherwise fall back to the gameStatus we computed
    const effectiveStatus = gameInfo?.status ?? gameStatus?.status ?? dbGameStatus;

    if (effectiveStatus === "live" || effectiveStatus === "final") {
      // Try boxscore first (only for today's games with external event ID)
      if (resolvedEventId) {
        const boxscore = boxscoreMap.get(resolvedEventId) ?? [];
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

      // Second fallback: use resolved result for trending even without actual_value.
      // This prevents the UI from showing "Pending" when resolution ran but
      // couldn't fetch boxscore data (e.g. external event ID was missing at resolution time).
      if (trending === null && pick.result) {
        if (pick.result === "hit" || pick.result === "miss" || pick.result === "push") {
          trending = pick.result as "hit" | "miss" | "push";
        }
      }
    }

    livePicks.push({
      pick_id: pick.id,
      player_name: pick.props.player_name,
      player_id: pick.props.player_id,
      player_team: pick.props.player_team ?? null,
      player_position: pick.props.player_position ?? null,
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
    if (pick.game_status && !seenGames.has(pick.game_status.external_event_id)) {
      seenGames.add(pick.game_status.external_event_id);
      games.push(pick.game_status);
    }
  }

  return {
    livePicks,
    games,
    hasLiveGames: liveGamesSet.size > 0,
  };
}

// ---------------------------------------------------------------------------
// Sport-agnostic fetcher config — adding a new sport = one entry here
// ---------------------------------------------------------------------------
interface SportFetchers {
  fetchGames: () => Promise<StatsGame[]>;
  fetchBoxscore: (id: string) => Promise<PlayerBoxScore[]>;
  fetchBoxscoreLive: (id: string) => Promise<PlayerBoxScore[]>;
  onGames?: (games: StatsGame[]) => void;
}

const SPORT_FETCHERS: Record<string, SportFetchers> = {
  nba: {
    fetchGames: fetchTodaysGamesLive,
    fetchBoxscore: fetchBoxscore,
    fetchBoxscoreLive: fetchBoxscoreLive,
  },
  epl: {
    fetchGames: fetchSoccerGamesLive,
    fetchBoxscore: fetchSoccerBoxscore,
    fetchBoxscoreLive: fetchSoccerBoxscoreLive,
  },
  la_liga: {
    fetchGames: fetchLaLigaGamesLive,
    fetchBoxscore: fetchSoccerBoxscore,
    fetchBoxscoreLive: fetchSoccerBoxscoreLive,
  },
  ncaab: {
    fetchGames: fetchNcaabGamesLive,
    fetchBoxscore: fetchNcaabBoxscore,
    fetchBoxscoreLive: fetchNcaabBoxscoreLive,
    onGames: (games) =>
      registerNcaabTeamIds(
        games.flatMap((g) => [
          { name: g.home_team, id: g.home_team_id ?? "" },
          { name: g.away_team, id: g.away_team_id ?? "" },
        ]),
      ),
  },
};

/**
 * Fetches live game statuses and boxscores for today's games.
 * Returns gameStatusMap and boxscoreMap ready for buildLivePicksForCard().
 *
 * Strategy:
 * 1. Collect all external event IDs from picks, grouped by sport
 * 2. Fetch today's games first (fast, 30s cached)
 * 3. Fetch boxscores for live, final, and non-today games
 */
export async function fetchLiveMaps(
  picks: PickWithPropAndGame[],
): Promise<{
  gameStatusMap: Map<string, StatsGame>;
  boxscoreMap: Map<string, PlayerBoxScore[]>;
}> {
  // Step 1: Group candidate IDs by sport
  const candidatesBySport = new Map<string, Set<string>>();
  for (const pick of picks) {
    const eventId = pick.props?.games?.external_event_id;
    if (!eventId) continue;
    const sport = pick.props?.games?.sport ?? "nba";
    let set = candidatesBySport.get(sport);
    if (!set) {
      set = new Set<string>();
      candidatesBySport.set(sport, set);
    }
    set.add(eventId);
  }

  const gameStatusMap = new Map<string, StatsGame>();
  const boxscoreMap = new Map<string, PlayerBoxScore[]>();

  if (candidatesBySport.size === 0) {
    return { gameStatusMap, boxscoreMap };
  }

  // Step 2: Fetch today's games in parallel (one call per sport with candidates)
  const sportEntries = Array.from(candidatesBySport.entries())
    .filter(([sport]) => SPORT_FETCHERS[sport]);

  const gamesPerSport = await Promise.all(
    sportEntries.map(([sport]) =>
      SPORT_FETCHERS[sport].fetchGames().catch((err) => {
        logError("stats-service", `Failed to fetch live games for ${sport}: ${err instanceof Error ? err.message : err}`);
        return [] as StatsGame[];
      }),
    ),
  );

  for (let i = 0; i < sportEntries.length; i++) {
    const [sport] = sportEntries[i];
    const games = gamesPerSport[i];

    for (const g of games) {
      gameStatusMap.set(g.game_id, g);
    }

    // Sport-specific post-processing (e.g. NCAAB team ID registration)
    if (games.length > 0) {
      SPORT_FETCHERS[sport].onGames?.(games);
    }
  }

  // Build a set of game IDs where ALL referencing picks already have
  // actual_value stored in the DB. No need to fetch boxscores for those —
  // buildLivePicksForCard will use the stored value instead.
  const gamesWithAllResolved = new Set<string>();
  const gamesWithUnresolved = new Set<string>();
  for (const pick of picks) {
    const eventId = pick.props?.games?.external_event_id;
    if (!eventId) continue;
    if (pick.actual_value != null && pick.result && pick.result !== "pending") {
      if (!gamesWithUnresolved.has(eventId)) {
        gamesWithAllResolved.add(eventId);
      }
    } else {
      gamesWithAllResolved.delete(eventId);
      gamesWithUnresolved.add(eventId);
    }
  }

  // Step 3: Fetch boxscores only for games that need them
  const fetches: Promise<void>[] = [];

  for (const [sport, candidateIds] of sportEntries) {
    const fetcher = SPORT_FETCHERS[sport];
    const ids = candidatesBySport.get(sport)!;

    const todayIds = Array.from(ids).filter((id) => gameStatusMap.has(id));
    const liveIds = todayIds.filter((id) => gameStatusMap.get(id)?.status === "live");
    const finalIds = todayIds.filter((id) =>
      gameStatusMap.get(id)?.status === "final" && !gamesWithAllResolved.has(id),
    );
    const nonTodayIds = Array.from(ids).filter((id) =>
      !gameStatusMap.has(id) && !gamesWithAllResolved.has(id),
    );

    // Live games — use the live boxscore endpoint (shorter cache)
    if (liveIds.length > 0) {
      fetches.push(
        pMap(
          liveIds,
          (gid) => fetcher.fetchBoxscoreLive(gid).catch((err) => {
            logError("stats-service", `Failed to fetch live boxscore for game ${gid}: ${err instanceof Error ? err.message : err}`);
            return [] as PlayerBoxScore[];
          }),
          BOXSCORE_CONCURRENCY,
        ).then((results) => {
          for (let i = 0; i < liveIds.length; i++) {
            boxscoreMap.set(liveIds[i], results[i]);
          }
        }),
      );
    }

    // Final + non-today games — use the standard boxscore endpoint (longer cache)
    const staticIds = [...finalIds, ...nonTodayIds];
    if (staticIds.length > 0) {
      fetches.push(
        pMap(
          staticIds,
          (gid) => fetcher.fetchBoxscore(gid).catch((err) => {
            logError("stats-service", `Failed to fetch boxscore for game ${gid}: ${err instanceof Error ? err.message : err}`);
            return [] as PlayerBoxScore[];
          }),
          BOXSCORE_CONCURRENCY,
        ).then((results) => {
          for (let i = 0; i < staticIds.length; i++) {
            boxscoreMap.set(staticIds[i], results[i]);
          }
        }),
      );
    }
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
