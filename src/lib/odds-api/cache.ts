import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SportKey } from "./constants";
import type { OddsApiEvent, ParsedPlayerProp } from "./types";
import type { Game, Prop } from "@/lib/supabase/types";
import {
  fetchAllPlayers, fetchNcaabPlayers, fetchNcaabTeams, fetchSoccerPlayers,
  fetchSoccerGamesByDate, fetchLaLigaGamesByDate, fetchCopaDelReyGamesByDate,
  type StatsGame,
} from "@/lib/stats-service/client";
import { teamsMatch } from "@/lib/team-matching";
import { lookbackDatesForSport } from "@/lib/sports/fetchers";
import { isSoccer } from "@/lib/sports/config";
import { logError, logInfo, logWarn } from "@/lib/logger";

/**
 * Returns true if a sync happened within the last 5 minutes,
 * preventing overlapping syncs during the delete-then-insert window.
 */
export async function isSyncOverlapping(): Promise<boolean> {
  const supabase = createAdminClient();
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const result = await supabase
    .from("props")
    .select("fetched_at")
    .gte("fetched_at", fiveMinAgo)
    .limit(1);

  if (result.error) {
    logError("props-cache", "isSyncOverlapping query failed", undefined, result.error);
    return false;
  }

  return (result.data ?? []).length > 0;
}

/**
 * Returns odds_api_event_ids for upcoming games that already have enough props.
 * A game is only skipped when BOTH teams have >= MIN_PROPS_TO_SKIP props each,
 * ensuring balanced coverage. Games where props have only arrived for one team
 * are re-fetched. When player_team data is unavailable (e.g. soccer), falls
 * back to total prop count.
 */
export const MIN_PROPS_TO_SKIP = 10;

/** Returns true if pre-aggregated per-team counts show enough coverage to skip polling. */
export function hasEnoughProps(
  teamCounts: Map<string, number>,
  threshold: number = MIN_PROPS_TO_SKIP,
): boolean {
  if (teamCounts.size === 0) return false;

  // Separate real teams from the null-team bucket (player_team was null)
  const nullCount = teamCounts.get("") ?? 0;
  const realTeamCount = teamCounts.size - (teamCounts.has("") ? 1 : 0);

  if (realTeamCount === 0) {
    // All props have null player_team (e.g. soccer, not enriched yet) — fall back to total
    return nullCount >= threshold;
  }

  if (realTeamCount === 1) {
    if (nullCount === 0) {
      // Only one real team and no unenriched props — other team truly has 0 props
      return false;
    }
    // One enriched team + unenriched props (common for soccer where enrichment
    // is partial). Fall back to total count — the null bucket likely contains
    // the other team's players.
    let total = nullCount;
    for (const [team, count] of teamCounts) {
      if (team !== "") total += count;
    }
    return total >= threshold;
  }

  // 2+ real teams: only skip if every real team meets the threshold
  let min = Infinity;
  for (const [team, count] of teamCounts) {
    if (team === "") continue;
    min = Math.min(min, count);
  }
  return min >= threshold;
}

export async function getEventIdsWithProps(): Promise<Set<string>> {
  const supabase = createAdminClient();

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data, error } = await (supabase.rpc as any)("get_event_team_counts", {
    range_start: rangeStart.toISOString(),
    range_end: rangeEnd.toISOString(),
  });

  if (error) {
    logWarn("props-cache", "get_event_team_counts RPC failed, skipping optimization", error);
    return new Set();
  }

  const rows = (data ?? []) as {
    odds_api_event_id: string;
    player_team: string | null;
    cnt: number;
  }[];

  // Group RPC rows into per-game team count maps
  const gameTeamCounts = new Map<string, Map<string, number>>();
  for (const row of rows) {
    let counts = gameTeamCounts.get(row.odds_api_event_id);
    if (!counts) {
      counts = new Map();
      gameTeamCounts.set(row.odds_api_event_id, counts);
    }
    // Coalesce null player_team to "" so it can be a Map key
    const team = row.player_team ?? "";
    counts.set(team, (counts.get(team) ?? 0) + row.cnt);
  }

  const skipSet = new Set<string>();
  for (const [eventId, counts] of gameTeamCounts) {
    if (hasEnoughProps(counts)) {
      skipSet.add(eventId);
    }
  }

  return skipSet;
}

async function getCachedPropsInternal(sport?: SportKey): Promise<
  (Game & { props: Prop[] })[] | null
> {
  const supabase = createAdminClient();

  // Look back 1 day and forward 7 days in UTC to cover:
  // - Tonight's games that may still be in progress or just ended
  // - Upcoming games within the next week (EPL plays weekly, NBA daily)
  // - Late-night games that cross into the next UTC day
  const now = new Date();
  const rangeStart = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0)
  );
  const rangeEnd = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999)
  );

  let query = supabase
    .from("games")
    .select("id, home_team, away_team, commence_time, sport, props(id, game_id, player_name, player_id, player_team, player_position, stat_category, line, line_history)")
    .gte("commence_time", rangeStart.toISOString())
    .lte("commence_time", rangeEnd.toISOString())
    .order("commence_time", { ascending: true });

  if (sport) {
    query = query.eq("sport", sport);
  }

  const result = await query;

  if (result.error) {
    logError("props-cache", "getCachedProps query failed", undefined, result.error);
    // Throw so unstable_cache does NOT cache the failure for 120s
    throw new Error(`getCachedProps query failed: ${result.error.message}`);
  }

  return result.data as (Game & { props: Prop[] })[] | null;
}

export const PROPS_CACHE_TAG = "props-page-data";

export const getCachedProps = unstable_cache(
  getCachedPropsInternal,
  [PROPS_CACHE_TAG],
  { revalidate: 120, tags: [PROPS_CACHE_TAG] }
);

async function getPropCountsBySportInternal(): Promise<Record<string, number>> {
  const supabase = createAdminClient();

  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  const rangeStart = new Date(now.getTime() + bufferMs);
  const rangeEnd = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999)
  );

  const result = await supabase
    .from("games")
    .select("sport, props(count)")
    .gte("commence_time", rangeStart.toISOString())
    .lte("commence_time", rangeEnd.toISOString());

  if (result.error) {
    logError("props-cache", "getPropCountsBySport query failed", undefined, result.error);
    // Throw so unstable_cache does NOT cache the failure for 120s
    throw new Error(`getPropCountsBySport query failed: ${result.error.message}`);
  }

  const games = (result.data ?? []) as { sport: string; props: { count: number }[] }[];

  const counts: Record<string, number> = {};
  for (const game of games) {
    const sport = game.sport || "nba";
    counts[sport] = (counts[sport] ?? 0) + (game.props[0]?.count ?? 0);
  }
  return counts;
}

export const getCachedPropCounts = unstable_cache(
  getPropCountsBySportInternal,
  [PROPS_CACHE_TAG, "prop-counts"],
  { revalidate: 120, tags: [PROPS_CACHE_TAG] }
);

export interface CachePropsResult {
  propsInserted: number;
  propsEnriched: number;
  playerMapSize: number;
}

// Intra-request lock: cacheProps is called in a loop (once per sport) within
// the same request. This prevents the loop iterations from interleaving.
// Cross-request protection is handled by isSyncOverlapping() in the sync route.
let _syncLock = false;

export async function cacheProps(
  events: OddsApiEvent[],
  propsMap: Map<string, ParsedPlayerProp[]>,
  sport: SportKey = "nba"
): Promise<CachePropsResult> {
  if (_syncLock) {
    return { propsInserted: 0, propsEnriched: 0, playerMapSize: 0 };
  }
  _syncLock = true;
  try {
    return await _cachePropsInternal(events, propsMap, sport);
  } finally {
    _syncLock = false;
  }
}

async function _cachePropsInternal(
  events: OddsApiEvent[],
  propsMap: Map<string, ParsedPlayerProp[]>,
  sport: SportKey
): Promise<CachePropsResult> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Normalize names for fuzzy matching: lowercase, strip accents/periods/suffixes
  function normalizeName(name: string): string {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip diacritics: ä→a, é→e, ü→u
      .toLowerCase()
      .replace(/\./g, "")     // "P.J." → "PJ"
      .replace(/'/g, "'")     // normalize apostrophes
      .replace(/\s+(jr|sr|iii|ii|iv)$/i, "") // strip suffixes (skip lone "v"/"i" — too ambiguous)
      .trim();
  }

  // Build player name → NBA player_id + team lookup maps
  // Only fetch NBA player enrichment for NBA sport
  let playerIdMap = new Map<string, string>();
  let playerTeamMap = new Map<string, string>();
  let playerPositionMap = new Map<string, string>();

  if (sport === "nba") {
    try {
      const allPlayers = await fetchAllPlayers();

      // Exact match maps
      playerIdMap = new Map(
        allPlayers.map((p) => [p.full_name.toLowerCase(), p.id])
      );
      playerTeamMap = new Map(
        allPlayers
          .filter((p) => p.team_abbreviation)
          .map((p) => [p.full_name.toLowerCase(), p.team_abbreviation!])
      );
      playerPositionMap = new Map(
        allPlayers
          .filter((p) => p.position)
          .map((p) => [p.full_name.toLowerCase(), p.position!])
      );

      // Normalized match maps (fallback for "Jr." vs "Jr", "P.J." vs "PJ", etc.)
      const normalizedIdMap = new Map(
        allPlayers.map((p) => [normalizeName(p.full_name), p.id])
      );
      const normalizedTeamMap = new Map(
        allPlayers
          .filter((p) => p.team_abbreviation)
          .map((p) => [normalizeName(p.full_name), p.team_abbreviation!])
      );
      const normalizedPositionMap = new Map(
        allPlayers
          .filter((p) => p.position)
          .map((p) => [normalizeName(p.full_name), p.position!])
      );

      // Merge normalized into main maps (exact match takes priority)
      for (const [key, val] of normalizedIdMap) {
        if (!playerIdMap.has(key)) playerIdMap.set(key, val);
      }
      for (const [key, val] of normalizedTeamMap) {
        if (!playerTeamMap.has(key)) playerTeamMap.set(key, val);
      }
      for (const [key, val] of normalizedPositionMap) {
        if (!playerPositionMap.has(key)) playerPositionMap.set(key, val);
      }
    } catch {
      // Stats service unavailable — player_id/team/position stays null, non-blocking
    }
  }

  if (sport === "ncaab") {
    try {
      // Get all D-I teams to find ESPN team IDs for teams in props
      const allTeams = await fetchNcaabTeams();

      // Normalize team names for matching: "St." → "saint", strip periods
      function normalizeTeamName(name: string): string {
        return name
          .toLowerCase()
          .replace(/\bst\.\s*/g, "saint ")
          .replace(/\bmt\.\s*/g, "mount ")
          .replace(/\./g, "")
          .replace(/\s+/g, " ")
          .trim();
      }

      // Build normalized ESPN lookup: normalized name → team ID
      const normalizedEspn = new Map<string, string>();
      for (const [espnName, id] of Object.entries(allTeams)) {
        normalizedEspn.set(normalizeTeamName(espnName), id);
      }

      // Collect unique team names from events and match to ESPN team IDs
      const propTeamNames = new Set<string>();
      for (const event of events) {
        propTeamNames.add(event.home_team);
        propTeamNames.add(event.away_team);
      }

      // Match prop team names to ESPN team IDs, preserving the original team name
      const matchedTeams: Array<[string, string]> = []; // [teamName, teamId]
      for (const teamName of propTeamNames) {
        const lower = teamName.toLowerCase();
        // 1. Exact match
        const exactId = allTeams[lower];
        if (exactId) { matchedTeams.push([teamName, exactId]); continue; }

        // 2. Normalized exact match (handles "St." vs "Saint", etc.)
        const normName = normalizeTeamName(teamName);
        const normId = normalizedEspn.get(normName);
        if (normId) { matchedTeams.push([teamName, normId]); continue; }

        // 3. Partial match (includes both ways) on normalized names
        let found = false;
        for (const [espnNorm, id] of normalizedEspn) {
          if (espnNorm.includes(normName) || normName.includes(espnNorm)) {
            matchedTeams.push([teamName, id]);
            found = true;
            break;
          }
        }
        if (!found) {
          logWarn("NCAAB enrich", `No ESPN match for team: "${teamName}"`);
        }
      }

      // Fetch rosters concurrently to build playerTeamMap alongside playerIdMap
      const rosterResults = await Promise.allSettled(
        matchedTeams.map(([teamName, teamId]) =>
          fetchNcaabPlayers([teamId]).then((roster) => ({ teamName, teamId, roster }))
        )
      );

      for (const outcome of rosterResults) {
        if (outcome.status === "fulfilled") {
          const { teamName, roster } = outcome.value;
          for (const [name, id] of Object.entries(roster)) {
            playerIdMap.set(name, id);
            playerIdMap.set(normalizeName(name), id);
            playerTeamMap.set(name.toLowerCase(), teamName);
            playerTeamMap.set(normalizeName(name), teamName);
          }
        } else {
          logError("NCAAB enrich", "Failed to fetch roster for a team", undefined, outcome.reason);
        }
      }
    } catch (err) {
      logError("NCAAB enrich", "Failed", undefined, err);
    }
  }

  if (sport === "epl" || sport === "la_liga") {
    try {
      // Collect unique team names from events
      const teamNames = new Set<string>();
      for (const event of events) {
        teamNames.add(event.home_team);
        teamNames.add(event.away_team);
      }

      const soccerPlayerMap = await fetchSoccerPlayers(
        Array.from(teamNames),
        sport
      );

      for (const [name, id] of Object.entries(soccerPlayerMap)) {
        playerIdMap.set(name.toLowerCase(), id);
        playerIdMap.set(normalizeName(name), id);
      }
    } catch (err) {
      logError(`${sport} enrich`, "Failed", undefined, err);
    }
  }

  // Lookup helper: tries exact match, then normalized, then fuzzy last-name,
  // then prefix matching for soccer compound names
  function lookupPlayer(name: string, map: Map<string, string>): string | null {
    const lower = name.toLowerCase();
    const normalized = normalizeName(name);
    // Exact match
    const exact = map.get(lower) ?? map.get(normalized);
    if (exact) return exact;

    const parts = normalized.split(/\s+/);
    if (parts.length < 2) return null;
    const lastName = parts[parts.length - 1];
    const firstInitial = parts[0][0];

    // Fuzzy: last name + first initial
    for (const [key, val] of map) {
      const keyParts = key.split(/\s+/);
      if (keyParts.length < 2) continue;
      const keyLast = keyParts[keyParts.length - 1];
      const keyFirstInitial = keyParts[0][0];
      if (keyLast === lastName && keyFirstInitial === firstInitial) {
        return val;
      }
    }

    // For 3+ word names, try dropping the last word (handles second surnames:
    // "Abel Ruiz Ortega" → try "abel ruiz" against map)
    if (parts.length >= 3) {
      const shortened = parts.slice(0, -1).join(" ");
      const match = map.get(shortened);
      if (match) return match;
    }

    // Prefix matching: check if a map key is a prefix of the name or vice versa.
    // Handles "Abel Ruiz" (api-sports) matching "Abel Ruiz Ortega" (odds API).
    // Requires at least 2 words and same first initial to avoid false positives.
    for (const [key, val] of map) {
      const keyNorm = normalizeName(key);
      const keyParts = keyNorm.split(/\s+/);
      if (keyParts.length < 2 || keyParts[0][0] !== firstInitial) continue;
      if (normalized.startsWith(keyNorm + " ") || keyNorm.startsWith(normalized + " ")) {
        return val;
      }
    }

    return null;
  }

  // For soccer, validate games against ESPN to filter out phantom matchups
  // (e.g. Copa del Rey games mislabeled as La Liga by the Odds API).
  let validEventIds: Set<string> | null = null;
  if (isSoccer(sport)) {
    try {
      const soccerFetchers: Record<string, Array<(date: string) => Promise<StatsGame[]>>> = {
        epl: [fetchSoccerGamesByDate],
        la_liga: [fetchLaLigaGamesByDate, fetchCopaDelReyGamesByDate],
      };
      const fetchers = soccerFetchers[sport] ?? [];

      // Collect unique dates from events (YYYYMMDD format)
      const eventDates = new Set<string>();
      for (const e of events) {
        if (!propsMap.has(e.id)) continue;
        for (const d of lookbackDatesForSport(sport, new Date(e.commence_time))) {
          eventDates.add(d);
        }
      }

      // Fetch all ESPN games for those dates
      const espnGames: StatsGame[] = [];
      for (const fetcher of fetchers) {
        for (const date of eventDates) {
          try {
            const games = await fetcher(date);
            espnGames.push(...games);
          } catch {
            // Non-fatal — if ESPN is down, skip validation
          }
        }
      }

      if (espnGames.length > 0) {
        // Match Odds API events to ESPN games by team names
        validEventIds = new Set<string>();
        for (const event of events) {
          if (!propsMap.has(event.id)) continue;
          const matched = espnGames.some(
            (g) =>
              teamsMatch(event.home_team, g.home_team) &&
              teamsMatch(event.away_team, g.away_team),
          );
          if (matched) {
            validEventIds.add(event.id);
          } else {
            propsMap.delete(event.id); // Remove props for this phantom game
          }
        }
      }
    } catch {
      // ESPN validation failed — proceed without filtering
    }
  }

  // Upsert games
  const gameRows = events
    .filter((e) => propsMap.has(e.id))
    .filter((e) => !validEventIds || validEventIds.has(e.id))
    .map((event) => ({
      odds_api_event_id: event.id,
      home_team: event.home_team,
      away_team: event.away_team,
      commence_time: event.commence_time,
      sport,
    }));

  if (gameRows.length === 0) return { propsInserted: 0, propsEnriched: 0, playerMapSize: playerIdMap.size };

  const { data: upsertedGames, error: gamesError } = await (supabase.from("games") as any)
    .upsert(gameRows, { onConflict: "odds_api_event_id" })
    .select("id, odds_api_event_id") as {
    data: { id: string; odds_api_event_id: string }[] | null;
    error: { message: string; code: string } | null;
  };

  if (gamesError) {
    logError(`${sport} cache`, `Games upsert failed: ${gamesError.message}`);
  }
  logInfo(`${sport} cache`, `Upserted ${upsertedGames?.length ?? 0} games from ${gameRows.length} rows`);
  if (!upsertedGames) return { propsInserted: 0, propsEnriched: 0, playerMapSize: playerIdMap.size };

  const eventToGameId = new Map(
    upsertedGames.map((g) => [g.odds_api_event_id, g.id])
  );

  // Refresh props for today's games. We never delete existing props — only
  // upsert — so that prop UUIDs stay stable across syncs. This prevents the
  // race condition where a user loads props, a sync runs, and the old IDs
  // become invalid before the user locks in.
  const gameIds = upsertedGames.map((g) => g.id);

  // Step 1: Fetch all existing props for enrichment preservation + line history
  const allPropsResult = await supabase
    .from("props")
    .select("id, game_id, player_name, stat_category, line, line_history, player_id, player_team, player_position")
    .in("game_id", gameIds);
  if (allPropsResult.error) {
    logError(`${sport} cache`, "Failed to fetch existing props", undefined, allPropsResult.error);
    return { propsInserted: 0, propsEnriched: 0, playerMapSize: playerIdMap.size };
  }
  const allProps = (allPropsResult.data ?? []) as {
    id: string; game_id: string; player_name: string; stat_category: string;
    line: number; line_history: Array<{ t: string; l: number }> | null;
    player_id: string | null; player_team: string | null; player_position: string | null;
  }[];

  // Build a lookup of existing enrichment data so a failed stats-service sync
  // doesn't wipe player_id/team/position on updated props.
  const oldEnrichment = new Map<string, { player_id: string | null; player_team: string | null; player_position: string | null }>();
  for (const p of allProps) {
    if (p.player_id || p.player_team || p.player_position) {
      oldEnrichment.set(`${p.game_id}|${p.player_name.toLowerCase()}|${p.stat_category}`, {
        player_id: p.player_id,
        player_team: p.player_team,
        player_position: p.player_position,
      });
    }
  }

  // Cross-game player name cache: query ALL known player_id mappings for this
  // sport so new games can reuse enrichment even when the stats service is down.
  // The per-game oldEnrichment above only covers props from today's games being
  // synced — this covers every player we've ever successfully enriched.
  // Uses a single join query instead of two-step games→props to reduce DB calls.
  const playerNameCache = new Map<string, { player_id: string; player_team: string | null; player_position: string | null }>();
  try {
    const { data: knownPlayers, error: knownPlayersError } = await supabase
      .from("props")
      .select("player_name, player_id, player_team, player_position, games!inner(sport)")
      .not("player_id", "is", null)
      .eq("games.sport", sport);

    if (knownPlayersError) {
      logWarn(`${sport} cache`, "Cross-game player cache query failed", knownPlayersError);
    }

    for (const p of (knownPlayers ?? []) as {
      player_name: string; player_id: string;
      player_team: string | null; player_position: string | null;
    }[]) {
      const key = p.player_name.toLowerCase();
      if (!playerNameCache.has(key)) {
        playerNameCache.set(key, {
          player_id: p.player_id,
          player_team: p.player_team,
          player_position: p.player_position,
        });
      }
    }
  } catch {
    // Non-blocking: cross-game cache is a best-effort optimization
  }

  // Step 2: Build fresh prop rows from API data
  const propRows: {
    game_id: string;
    player_name: string;
    player_id: string | null;
    player_team: string | null;
    player_position: string | null;
    stat_category: string;
    line: number;
    over_odds: number | null;
    under_odds: number | null;
    bookmaker: string | null;
    fetched_at: string;
    line_history: Array<{ t: string; l: number }>;
  }[] = [];

  for (const [eventId, props] of propsMap) {
    const gameId = eventToGameId.get(eventId);
    if (!gameId) continue;

    for (const prop of props) {
      // Skip props with invalid lines (e.g. NaN from missing point values)
      if (prop.line == null || Number.isNaN(prop.line)) continue;

      // Carry over old enrichment when the stats service is down
      const freshId = lookupPlayer(prop.player_name, playerIdMap);
      const freshTeam = lookupPlayer(prop.player_name, playerTeamMap);
      const freshPosition = lookupPlayer(prop.player_name, playerPositionMap);
      const old = oldEnrichment.get(`${gameId}|${prop.player_name.toLowerCase()}|${prop.stat_category}`);

      propRows.push({
        game_id: gameId,
        player_name: prop.player_name,
        player_id: freshId ?? old?.player_id ?? playerNameCache.get(prop.player_name.toLowerCase())?.player_id ?? null,
        player_team: freshTeam ?? old?.player_team ?? playerNameCache.get(prop.player_name.toLowerCase())?.player_team ?? null,
        player_position: freshPosition ?? old?.player_position ?? playerNameCache.get(prop.player_name.toLowerCase())?.player_position ?? null,
        stat_category: prop.stat_category,
        line: prop.line,
        over_odds: prop.over_odds,
        under_odds: prop.under_odds,
        bookmaker: prop.bookmaker,
        fetched_at: now,
        line_history: [{ t: now, l: prop.line }],
      });
    }
  }

  // Step 3: Batch-update all existing props with fresh odds + player data (preserves UUIDs + line history)
  // Build a lookup for O(1) matching instead of O(n²) .find() per prop
  const propRowsMap = new Map(
    propRows.map((r) => [`${r.game_id}|${r.player_name.toLowerCase()}|${r.stat_category}`, r])
  );

  const updatePayloads: Record<string, unknown>[] = [];
  for (const kept of allProps) {
    const match = propRowsMap.get(`${kept.game_id}|${kept.player_name.toLowerCase()}|${kept.stat_category}`);
    if (!match) continue;

    // Track line movement: append new entry if line changed
    let lineHistory = kept.line_history ?? [];
    if (match.line !== kept.line) {
      if (lineHistory.length === 0) {
        lineHistory = [{ t: kept.line_history?.[0]?.t ?? now, l: kept.line }];
      }
      lineHistory = [...lineHistory, { t: now, l: match.line }];
    }

    // Only overwrite enrichment fields if the new value is non-null,
    // so a failed stats-service sync doesn't clobber existing data.
    const payload: Record<string, unknown> = {
      id: kept.id,
      game_id: kept.game_id,
      player_name: kept.player_name,
      stat_category: kept.stat_category,
      line: match.line,
      over_odds: match.over_odds,
      under_odds: match.under_odds,
      fetched_at: now,
      line_history: lineHistory.length > 0 ? lineHistory : null,
    };
    if (match.bookmaker !== null) payload.bookmaker = match.bookmaker;
    if (match.player_id !== null) payload.player_id = match.player_id;
    if (match.player_team !== null) payload.player_team = match.player_team;
    if (match.player_position !== null) payload.player_position = match.player_position;
    updatePayloads.push(payload);
  }

  // Batch upsert on id — single round-trip per 500 rows instead of N+1
  let updateFailedBatches = 0;
  for (let i = 0; i < updatePayloads.length; i += 500) {
    const batch = updatePayloads.slice(i, i + 500);
    const { error: updateError } = await (supabase.from("props") as any).upsert(batch, {
      onConflict: "id",
      ignoreDuplicates: false,
    });
    if (updateError) {
      logError(`${sport} cache`, `Props batch update failed (batch ${i / 500 + 1})`, undefined, updateError);
      updateFailedBatches++;
    }
  }

  // Step 4: Insert truly new props (ones that don't exist in the DB yet)
  const existingKeys = new Set(
    allProps.map((p) => `${p.game_id}|${p.player_name.toLowerCase()}|${p.stat_category}`)
  );
  const newPropRows = propRows.filter(
    (r) => !existingKeys.has(`${r.game_id}|${r.player_name.toLowerCase()}|${r.stat_category}`)
  );

  if (newPropRows.length > 0) {
    for (let i = 0; i < newPropRows.length; i += 500) {
      const batch = newPropRows.slice(i, i + 500);
       
      const { error: insertError } = await (supabase.from("props") as any).upsert(batch, {
        onConflict: "game_id,player_name,stat_category",
        ignoreDuplicates: false,
      });
      if (insertError) {
        logError(`${sport} cache`, `Props upsert failed (batch ${i / 500 + 1}): ${insertError.message}`);
      }
    }
  }

  const staleCount = allProps.length - updatePayloads.length;
  const updateSuffix = updateFailedBatches > 0 ? ` (${updateFailedBatches} batch failures)` : "";
  logInfo(`${sport} cache`, `Prepared ${propRows.length} props, inserted ${newPropRows.length} new, updated ${updatePayloads.length} existing${updateSuffix}, ${staleCount} stale`);
  const enrichedCount = propRows.filter((r) => r.player_id !== null).length;
  return { propsInserted: newPropRows.length, propsEnriched: enrichedCount, playerMapSize: playerIdMap.size };
}
