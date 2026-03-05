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
import { normalizeTeam, teamsMatch } from "@/lib/team-matching";
import { isSoccer } from "@/lib/sports/config";

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

  return (result.data ?? []).length > 0;
}

/**
 * Returns odds_api_event_ids for upcoming games that already have enough props.
 * Games with fewer than MIN_PROPS_TO_SKIP props are NOT included, so the sync
 * pipeline re-fetches them — this handles games where only a few early props
 * appeared but the Odds API adds more throughout the day.
 */
const MIN_PROPS_TO_SKIP = 10;

export async function getEventIdsWithProps(): Promise<Set<string>> {
  const supabase = createAdminClient();

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const result = await supabase
    .from("games")
    .select("odds_api_event_id, props(count)")
    .gte("commence_time", rangeStart.toISOString())
    .lte("commence_time", rangeEnd.toISOString())
    .not("odds_api_event_id", "is", null);

  const games = (result.data ?? []) as {
    odds_api_event_id: string;
    props: { count: number }[];
  }[];

  return new Set(
    games
      .filter((g) => (g.props[0]?.count ?? 0) >= MIN_PROPS_TO_SKIP)
      .map((g) => g.odds_api_event_id)
  );
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
          console.warn(`[NCAAB enrich] No ESPN match for team: "${teamName}"`);
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
          console.warn(`[NCAAB enrich] Failed to fetch roster for a team:`, outcome.reason);
        }
      }
    } catch (err) {
      console.error("[NCAAB enrich] Failed:", err);
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
      console.error(`[${sport} enrich] Failed:`, err);
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
        const d = new Date(e.commence_time);
        eventDates.add(d.toISOString().slice(0, 10).replace(/-/g, ""));
        // Also check day before/after for timezone edge cases
        const dayBefore = new Date(d);
        dayBefore.setDate(dayBefore.getDate() - 1);
        eventDates.add(dayBefore.toISOString().slice(0, 10).replace(/-/g, ""));
        const dayAfter = new Date(d);
        dayAfter.setDate(dayAfter.getDate() + 1);
        eventDates.add(dayAfter.toISOString().slice(0, 10).replace(/-/g, ""));
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: upsertedGames, error: gamesError } = await (supabase.from("games") as any)
    .upsert(gameRows, { onConflict: "odds_api_event_id" })
    .select("id, odds_api_event_id") as {
    data: { id: string; odds_api_event_id: string }[] | null;
    error: { message: string; code: string } | null;
  };

  if (gamesError) {
    console.error(`[${sport} cache] Games upsert failed:`, gamesError);
  }
  console.log(`[${sport} cache] Upserted ${upsertedGames?.length ?? 0} games from ${gameRows.length} rows`);
  if (!upsertedGames) return { propsInserted: 0, propsEnriched: 0, playerMapSize: playerIdMap.size };

  const eventToGameId = new Map(
    upsertedGames.map((g) => [g.odds_api_event_id, g.id])
  );

  // Refresh props for today's games, preserving any that have picks (ON DELETE CASCADE)
  const gameIds = upsertedGames.map((g) => g.id);

  // Step 1: Find prop IDs referenced by picks — must NOT be deleted
  const allPropsResult = await supabase
    .from("props")
    .select("id, game_id, player_name, stat_category, line, line_history, player_id, player_team, player_position")
    .in("game_id", gameIds);
  const allProps = (allPropsResult.data ?? []) as {
    id: string; game_id: string; player_name: string; stat_category: string;
    line: number; line_history: Array<{ t: string; l: number }> | null;
    player_id: string | null; player_team: string | null; player_position: string | null;
  }[];

  const allPropIds = allProps.map((p) => p.id);
  let pickedPropIds = new Set<string>();

  if (allPropIds.length > 0) {
    // Query picks that reference any of these props
    const picksResult = await supabase
      .from("picks")
      .select("prop_id")
      .in("prop_id", allPropIds);
    pickedPropIds = new Set(
      ((picksResult.data ?? []) as { prop_id: string }[]).map((r) => r.prop_id)
    );
  }

  // Build a lookup of existing enrichment data so a failed stats-service sync
  // doesn't wipe player_id/team/position on re-inserted props.
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
    const { data: knownPlayers } = await supabase
      .from("props")
      .select("player_name, player_id, player_team, player_position, games!inner(sport)")
      .not("player_id", "is", null)
      .eq("games.sport", sport);

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

  // Step 2: Delete only props that have NO picks
  const deletableIds = allPropIds.filter((id) => !pickedPropIds.has(id));
  if (deletableIds.length > 0) {
    for (let i = 0; i < deletableIds.length; i += 500) {
      const batch = deletableIds.slice(i, i + 500);
      await supabase.from("props").delete().in("id", batch);
    }
  }

  // Step 3: Build fresh prop rows from API data
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

  // Step 4: Update kept (picked) props with fresh odds + player data
  const keptProps = allProps.filter((p) => pickedPropIds.has(p.id));
  for (const kept of keptProps) {
    const match = propRows.find(
      (r) =>
        r.game_id === kept.game_id &&
        r.player_name.toLowerCase() === kept.player_name.toLowerCase() &&
        r.stat_category === kept.stat_category
    );
    if (match) {
      // Track line movement: append new entry if line changed
      let lineHistory = kept.line_history ?? [];
      if (match.line !== kept.line) {
        // Seed with the old line if history is empty
        if (lineHistory.length === 0) {
          lineHistory = [{ t: kept.line_history?.[0]?.t ?? now, l: kept.line }];
        }
        lineHistory = [...lineHistory, { t: now, l: match.line }];
      }

      // Only overwrite enrichment fields if the new value is non-null,
      // so a failed stats-service sync doesn't clobber existing data.
      const updatePayload: Record<string, unknown> = {
        line: match.line,
        over_odds: match.over_odds,
        under_odds: match.under_odds,
        fetched_at: now,
        line_history: lineHistory.length > 0 ? lineHistory : null,
      };
      if (match.player_id !== null) updatePayload.player_id = match.player_id;
      if (match.player_team !== null) updatePayload.player_team = match.player_team;
      if (match.player_position !== null) updatePayload.player_position = match.player_position;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("props") as any)
        .update(updatePayload)
        .eq("id", kept.id);
    }
  }

  // Step 5: Insert fresh props, skipping any that duplicate a kept prop
  // (same game + player + stat = already exists as a kept prop)
  const keptKeys = new Set(
    keptProps.map((p) => `${p.game_id}|${p.player_name.toLowerCase()}|${p.stat_category}`)
  );
  const newPropRows = propRows.filter(
    (r) => !keptKeys.has(`${r.game_id}|${r.player_name.toLowerCase()}|${r.stat_category}`)
  );

  if (newPropRows.length > 0) {
    for (let i = 0; i < newPropRows.length; i += 500) {
      const batch = newPropRows.slice(i, i + 500);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase.from("props") as any).upsert(batch, {
        onConflict: "game_id,player_name,stat_category",
        ignoreDuplicates: false,
      });
      if (insertError) {
        console.error(`[${sport} cache] Props upsert failed (batch ${i / 500 + 1}):`, insertError);
      }
    }
  }

  console.log(`[${sport} cache] Prepared ${propRows.length} props, inserted ${newPropRows.length} new (${keptProps.length} kept)`);
  const enrichedCount = propRows.filter((r) => r.player_id !== null).length;
  return { propsInserted: newPropRows.length, propsEnriched: enrichedCount, playerMapSize: playerIdMap.size };
}
