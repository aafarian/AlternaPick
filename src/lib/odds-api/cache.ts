import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { CACHE_TTL_MS } from "./constants";
import type { OddsApiEvent, ParsedPlayerProp } from "./types";
import type { Game, Prop } from "@/lib/supabase/types";
import { fetchAllPlayers } from "@/lib/stats-service/client";

export async function isCacheStale(): Promise<boolean> {
  const supabase = createAdminClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const gamesResult = await supabase
    .from("games")
    .select("id")
    .gte("commence_time", todayStart.toISOString())
    .lte("commence_time", todayEnd.toISOString());

  const games = (gamesResult.data ?? []) as Pick<Game, "id">[];
  if (games.length === 0) return true;

  const gameIds = games.map((g) => g.id);
  const propsResult = await supabase
    .from("props")
    .select("fetched_at")
    .in("game_id", gameIds)
    .order("fetched_at", { ascending: false })
    .limit(1);

  const props = (propsResult.data ?? []) as Pick<Prop, "fetched_at">[];
  if (props.length === 0) return true;

  const lastFetched = new Date(props[0].fetched_at).getTime();
  return now.getTime() - lastFetched > CACHE_TTL_MS;
}

async function getCachedPropsInternal(): Promise<
  (Game & { props: Prop[] })[] | null
> {
  const supabase = createAdminClient();

  // Look back 1 day and forward 2 days in UTC to cover:
  // - Tonight's games that may still be in progress or just ended
  // - Tomorrow's upcoming games (which the Odds API returns early)
  // - Late-night games that cross into the next UTC day
  const now = new Date();
  const rangeStart = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0)
  );
  const rangeEnd = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 2, 23, 59, 59, 999)
  );

  const result = await supabase
    .from("games")
    .select("id, home_team, away_team, commence_time, props(id, game_id, player_name, player_id, player_team, player_position, stat_category, line, line_history)")
    .gte("commence_time", rangeStart.toISOString())
    .lte("commence_time", rangeEnd.toISOString())
    .order("commence_time", { ascending: true });

  return result.data as (Game & { props: Prop[] })[] | null;
}

export const PROPS_CACHE_TAG = "props-page-data";

export const getCachedProps = unstable_cache(
  getCachedPropsInternal,
  [PROPS_CACHE_TAG],
  { revalidate: 120, tags: [PROPS_CACHE_TAG] }
);

export async function cacheProps(
  events: OddsApiEvent[],
  propsMap: Map<string, ParsedPlayerProp[]>
) {
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
      .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "") // strip suffixes
      .trim();
  }

  // Build player name → NBA player_id + team lookup maps
  let playerIdMap = new Map<string, string>();
  let playerTeamMap = new Map<string, string>();
  let playerPositionMap = new Map<string, string>();
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

  // Lookup helper: tries exact match first, then normalized
  function lookupPlayer(name: string, map: Map<string, string>): string | null {
    return map.get(name.toLowerCase()) ?? map.get(normalizeName(name)) ?? null;
  }

  // Upsert games
  const gameRows = events
    .filter((e) => propsMap.has(e.id))
    .map((event) => ({
      odds_api_event_id: event.id,
      home_team: event.home_team,
      away_team: event.away_team,
      commence_time: event.commence_time,
    }));

  if (gameRows.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: upsertedGames } = await (supabase.from("games") as any)
    .upsert(gameRows, { onConflict: "odds_api_event_id" })
    .select("id, odds_api_event_id") as {
    data: { id: string; odds_api_event_id: string }[] | null;
  };

  if (!upsertedGames) return;

  const eventToGameId = new Map(
    upsertedGames.map((g) => [g.odds_api_event_id, g.id])
  );

  // Refresh props for today's games, preserving any that have picks (ON DELETE CASCADE)
  const gameIds = upsertedGames.map((g) => g.id);

  // Step 1: Find prop IDs referenced by picks — must NOT be deleted
  const allPropsResult = await supabase
    .from("props")
    .select("id, game_id, player_name, stat_category, line, line_history")
    .in("game_id", gameIds);
  const allProps = (allPropsResult.data ?? []) as {
    id: string; game_id: string; player_name: string; stat_category: string;
    line: number; line_history: Array<{ t: string; l: number }> | null;
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
      propRows.push({
        game_id: gameId,
        player_name: prop.player_name,
        player_id: lookupPlayer(prop.player_name, playerIdMap),
        player_team: lookupPlayer(prop.player_name, playerTeamMap),
        player_position: lookupPlayer(prop.player_name, playerPositionMap),
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("props") as any)
        .update({
          line: match.line,
          over_odds: match.over_odds,
          under_odds: match.under_odds,
          player_id: match.player_id,
          player_team: match.player_team,
          player_position: match.player_position,
          fetched_at: now,
          line_history: lineHistory.length > 0 ? lineHistory : null,
        })
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
      await (supabase.from("props") as any).insert(batch);
    }
  }
}
