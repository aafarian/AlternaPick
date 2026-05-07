import { logError } from "@/lib/logger";

const STATS_SERVICE_URL =
  process.env.STATS_SERVICE_URL || "http://localhost:8000";
const TIMEOUT_MS = 8_000;
const BOXSCORE_TIMEOUT_MS = 10_000;

// Module-level TTL cache for live endpoints (30s) and final boxscores (1hr)
const CACHE_TTL = 30_000;
const FINAL_CACHE_TTL = 3_600_000;
const MAX_CACHE_SIZE = 500;
const cache = new Map<string, { data: unknown; expiry: number }>();

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttl: number = CACHE_TTL): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiry) cache.delete(k);
    }
    // Still over limit — drop oldest entries (Map preserves insertion order)
    if (cache.size >= MAX_CACHE_SIZE) {
      const toDelete = cache.size - MAX_CACHE_SIZE + 50;
      let deleted = 0;
      for (const k of cache.keys()) {
        if (deleted >= toDelete) break;
        cache.delete(k);
        deleted++;
      }
    }
  }
  cache.set(key, { data, expiry: Date.now() + ttl });
}

export interface StatsGame {
  game_id: string;
  home_team: string;
  home_tricode: string;
  away_team: string;
  away_tricode: string;
  home_score: number;
  away_score: number;
  status: string;
  period: number;
  clock: string;
  start_time: string;
  // ESPN-specific fields (NCAAB)
  home_team_id?: string;
  away_team_id?: string;
}

export interface NbaPlayer {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  team_abbreviation?: string;
  position?: string;
}

export interface PlayerBoxScore {
  player_name: string;
  player_id: string;
  team: string;
  team_tricode: string;
  minutes: string;
  points: number;
  rebounds: number;
  offensive_rebounds: number;
  defensive_rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  threes_made: number;
  threes_attempted: number;
  field_goals_made: number;
  field_goals_attempted: number;
  free_throws_made: number;
  free_throws_attempted: number;
  plus_minus: number;
  fouls: number;
  // Soccer-specific stats (optional, present when fetched from soccer endpoints)
  goals?: number;
  shots?: number;
  shots_on_target?: number;
  tackles?: number;
  passes?: number;
  fouls_committed?: number;
  saves?: number;
  // Baseball-specific stats (optional, present when fetched from MLB endpoints)
  hits?: number;
  home_runs?: number;
  rbis?: number;
  runs?: number;
  stolen_bases?: number;
  total_bases?: number;
  pitcher_strikeouts?: number;
  pitcher_outs?: number;
  hits_runs_rbis?: number;
  /** True when the player was on the roster but did not play */
  dnp?: boolean;
}

export interface GameLogEntry {
  game_date: string;
  matchup: string;
  result: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  threes_made: number;
  field_goals: string;
  free_throws: string;
  plus_minus: number;
}

export interface SeasonAverages {
  games_played: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  threes_made: number;
}

export interface PlayerGamelogData {
  games: GameLogEntry[];
  season_averages: SeasonAverages;
}

class StatsServiceError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "StatsServiceError";
  }
}

// --- Circuit breaker ---
// After CIRCUIT_OPEN_THRESHOLD consecutive failures, stop calling the stats
// service for CIRCUIT_COOLDOWN_MS to let it recover.
const CIRCUIT_OPEN_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 30_000;
let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function checkCircuitBreaker(): void {
  if (Date.now() < circuitOpenUntil) {
    throw new StatsServiceError("Stats service circuit breaker open", 503);
  }
}

function recordSuccess(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

function recordFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_OPEN_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    logError("stats-service", `Circuit breaker OPEN after ${consecutiveFailures} consecutive failures, cooldown ${CIRCUIT_COOLDOWN_MS / 1000}s`);
  }
}

async function fetchWithRetry(
  url: string,
  retries = 1,
  timeout = TIMEOUT_MS
): Promise<Response> {
  checkCircuitBreaker();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        timeout
      );

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (response.ok) {
        recordSuccess();
        return response;
      }

      if ([502, 503, 504, 429].includes(response.status) && attempt < retries) {
        const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      recordFailure();
      throw new StatsServiceError(
        `Stats service error: ${response.status}`,
        response.status
      );
    } catch (error) {
      if (error instanceof StatsServiceError) throw error;
      if (attempt < retries) {
        const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      recordFailure();
      const urlPath = url.replace(STATS_SERVICE_URL, "");
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new StatsServiceError(
          `Stats service timeout after ${timeout}ms: ${urlPath}`,
          504
        );
      }
      throw new StatsServiceError(
        `Stats service network error: ${error instanceof Error ? error.message : "Unknown error"} (${urlPath})`,
        503
      );
    }
  }
  recordFailure();
  throw new StatsServiceError("Stats service unreachable", 503);
}

// --- NBA endpoints ---

export async function fetchTodaysGames(): Promise<StatsGame[]> {
  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/games/today`
  );
  const data = await response.json();
  return data.data ?? [];
}

export async function fetchNbaGamesByDate(date: string): Promise<StatsGame[]> {
  const cacheKey = `nbaGamesByDate:${date}`;
  const cached = getCached<StatsGame[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/games/today?date=${encodeURIComponent(date)}`
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result, FINAL_CACHE_TTL);
  return result;
}

export async function fetchBoxscore(
  gameId: string
): Promise<PlayerBoxScore[]> {
  const cacheKey = `boxscore:${gameId}`;
  const cached = getCached<PlayerBoxScore[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/games/${gameId}/boxscore`,
    1,
    BOXSCORE_TIMEOUT_MS
  );
  const data = await response.json();
  const result = data.data ?? [];
  // Only cache non-empty boxscores for 1hr — empty results use short TTL
  // so the next poll retries instead of serving stale empty data
  setCache(cacheKey, result, result.length > 0 ? FINAL_CACHE_TTL : CACHE_TTL);
  return result;
}

export async function fetchPlayerStats(
  playerName: string
): Promise<PlayerBoxScore | null> {
  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/players/${encodeURIComponent(playerName)}/stats`
  );
  const data = await response.json();
  return data.data ?? null;
}

export async function fetchAllPlayers(): Promise<NbaPlayer[]> {
  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/players/all`
  );
  const data = await response.json();
  return data.data ?? [];
}

export async function fetchBoxscoreLive(
  gameId: string
): Promise<PlayerBoxScore[]> {
  const cacheKey = `boxscoreLive:${gameId}`;
  const cached = getCached<PlayerBoxScore[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/games/${gameId}/boxscore/live`,
    1,
    BOXSCORE_TIMEOUT_MS
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result);
  return result;
}

export async function fetchTodaysGamesLive(): Promise<StatsGame[]> {
  const cacheKey = "todaysGamesLive";
  const cached = getCached<StatsGame[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/games/today/live`
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result);
  return result;
}

// --- Soccer (EPL) endpoints ---

export async function fetchSoccerGames(): Promise<StatsGame[]> {
  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/soccer/games/today`
  );
  const data = await response.json();
  return data.data ?? [];
}

export async function fetchSoccerGamesByDate(date: string): Promise<StatsGame[]> {
  const cacheKey = `soccerGamesByDate:${date}`;
  const cached = getCached<StatsGame[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/soccer/games/today?date=${encodeURIComponent(date)}`
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result, CACHE_TTL);
  return result;
}

/**
 * Fetch a single soccer fixture by ESPN event ID.
 * Bypasses by-date lookups (which depend on season config).
 */
export async function fetchSoccerFixtureById(fixtureId: string): Promise<StatsGame | null> {
  const cacheKey = `soccerFixture:${fixtureId}`;
  const cached = getCached<StatsGame | null>(cacheKey);
  if (cached !== undefined) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/soccer/games/${encodeURIComponent(fixtureId)}`
  );
  const data = await response.json();
  const result = data.data ?? null;
  const ttl = result?.status === "final" ? FINAL_CACHE_TTL : CACHE_TTL;
  setCache(cacheKey, result, ttl);
  return result;
}

export async function fetchSoccerGamesLive(): Promise<StatsGame[]> {
  const cacheKey = "soccerGamesLive";
  const cached = getCached<StatsGame[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/soccer/games/today/live`
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result);
  return result;
}

export async function fetchSoccerBoxscore(
  fixtureId: string
): Promise<PlayerBoxScore[]> {
  const cacheKey = `soccerBoxscore:${fixtureId}`;
  const cached = getCached<PlayerBoxScore[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/soccer/games/${fixtureId}/boxscore`,
    1,
    BOXSCORE_TIMEOUT_MS
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result, result.length > 0 ? FINAL_CACHE_TTL : CACHE_TTL);
  return result;
}

// --- La Liga endpoints ---

export async function fetchLaLigaGames(): Promise<StatsGame[]> {
  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/soccer/games/today?league=la_liga`
  );
  const data = await response.json();
  return data.data ?? [];
}

export async function fetchLaLigaGamesByDate(date: string): Promise<StatsGame[]> {
  const cacheKey = `laLigaGamesByDate:${date}`;
  const cached = getCached<StatsGame[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/soccer/games/today?league=la_liga&date=${encodeURIComponent(date)}`
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result, CACHE_TTL);
  return result;
}

export async function fetchLaLigaGamesLive(): Promise<StatsGame[]> {
  const cacheKey = "laLigaGamesLive";
  const cached = getCached<StatsGame[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/soccer/games/today/live?league=la_liga`
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result);
  return result;
}

// --- Copa del Rey (ESPN) endpoints ---

export async function fetchCopaDelReyGamesByDate(date: string): Promise<StatsGame[]> {
  const cacheKey = `copaDelReyGamesByDate:${date}`;
  const cached = getCached<StatsGame[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/soccer/games/today?league=copa_del_rey&date=${encodeURIComponent(date)}`
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result, CACHE_TTL);
  return result;
}

// --- NCAAB (ESPN) endpoints ---

export async function fetchNcaabGames(): Promise<StatsGame[]> {
  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/ncaab/games/today`
  );
  const data = await response.json();
  return data.data ?? [];
}

export async function fetchNcaabGamesByDate(date: string): Promise<StatsGame[]> {
  const cacheKey = `ncaabGamesByDate:${date}`;
  const cached = getCached<StatsGame[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/ncaab/games/today?date=${encodeURIComponent(date)}`
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result, FINAL_CACHE_TTL);
  return result;
}

export async function fetchNcaabGamesLive(): Promise<StatsGame[]> {
  const cacheKey = "ncaabGamesLive";
  const cached = getCached<StatsGame[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/ncaab/games/today/live`
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result);
  return result;
}

export async function fetchNcaabBoxscore(
  eventId: string
): Promise<PlayerBoxScore[]> {
  const cacheKey = `ncaabBoxscore:${eventId}`;
  const cached = getCached<PlayerBoxScore[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/ncaab/games/${eventId}/boxscore`,
    1,
    BOXSCORE_TIMEOUT_MS
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result, result.length > 0 ? FINAL_CACHE_TTL : CACHE_TTL);
  return result;
}

export async function fetchNcaabBoxscoreLive(
  eventId: string
): Promise<PlayerBoxScore[]> {
  const cacheKey = `ncaabBoxscoreLive:${eventId}`;
  const cached = getCached<PlayerBoxScore[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/ncaab/games/${eventId}/boxscore/live`,
    1,
    BOXSCORE_TIMEOUT_MS
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result);
  return result;
}

export async function fetchNcaabTeams(): Promise<Record<string, string>> {
  const cacheKey = "ncaabTeams";
  const cached = getCached<Record<string, string>>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/ncaab/teams`
  );
  const data = await response.json();
  const result = (data.data ?? {}) as Record<string, string>;
  setCache(cacheKey, result, FINAL_CACHE_TTL);
  return result;
}

export async function fetchNcaabPlayers(
  teamIds?: string[]
): Promise<Record<string, string>> {
  const idsParam = teamIds?.join(",") ?? "";
  const cacheKey = `ncaabPlayers:${idsParam}`;
  const cached = getCached<Record<string, string>>(cacheKey);
  if (cached) return cached;

  const url = idsParam
    ? `${STATS_SERVICE_URL}/ncaab/players?team_ids=${encodeURIComponent(idsParam)}`
    : `${STATS_SERVICE_URL}/ncaab/players`;
  const response = await fetchWithRetry(url, 0, 30_000);
  const data = await response.json();
  const result = (data.data ?? {}) as Record<string, string>;
  setCache(cacheKey, result, FINAL_CACHE_TTL);
  return result;
}

export async function fetchSoccerPlayers(
  teamNames: string[],
  league: string
): Promise<Record<string, string>> {
  const cacheKey = `soccerPlayers:${league}:${teamNames.sort().join(",")}`;
  const cached = getCached<Record<string, string>>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/soccer/players?team_names=${encodeURIComponent(teamNames.join(","))}&league=${encodeURIComponent(league)}`,
    0,
    120_000
  );
  const data = await response.json();
  const result = (data.data ?? {}) as Record<string, string>;
  setCache(cacheKey, result, FINAL_CACHE_TTL);
  return result;
}

export async function fetchSoccerBoxscoreLive(
  fixtureId: string
): Promise<PlayerBoxScore[]> {
  const cacheKey = `soccerBoxscoreLive:${fixtureId}`;
  const cached = getCached<PlayerBoxScore[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/soccer/games/${fixtureId}/boxscore/live`,
    1,
    BOXSCORE_TIMEOUT_MS
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result);
  return result;
}

// --- MLB ---

export async function fetchMlbGames(): Promise<StatsGame[]> {
  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/mlb/games/today`
  );
  const data = await response.json();
  return data.data ?? [];
}

export async function fetchMlbGamesByDate(date: string): Promise<StatsGame[]> {
  const cacheKey = `mlbGamesByDate:${date}`;
  const cached = getCached<StatsGame[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/mlb/games/today?date=${encodeURIComponent(date)}`
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result, FINAL_CACHE_TTL);
  return result;
}

export async function fetchMlbGamesLive(): Promise<StatsGame[]> {
  const cacheKey = "mlbGamesLive";
  const cached = getCached<StatsGame[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/mlb/games/today/live`
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result);
  return result;
}

export async function fetchMlbBoxscore(
  eventId: string
): Promise<PlayerBoxScore[]> {
  const cacheKey = `mlbBoxscore:${eventId}`;
  const cached = getCached<PlayerBoxScore[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/mlb/boxscore/${encodeURIComponent(eventId)}`
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result, FINAL_CACHE_TTL);
  return result;
}

export async function fetchMlbBoxscoreLive(
  eventId: string
): Promise<PlayerBoxScore[]> {
  const cacheKey = `mlbBoxscoreLive:${eventId}`;
  const cached = getCached<PlayerBoxScore[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/mlb/games/${encodeURIComponent(eventId)}/boxscore/live`
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result);
  return result;
}

export async function fetchMlbPlayers(
  teamIds?: string[]
): Promise<Record<string, string>> {
  const params = teamIds ? `?team_ids=${teamIds.join(",")}` : "";
  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/mlb/players${params}`
  );
  const data = await response.json();
  return data.data ?? {};
}

// --- Player gamelog ---

export async function fetchPlayerGamelog(
  playerId: string,
  sport: string = "nba",
  lastN: number = 5,
  playerName?: string
): Promise<PlayerGamelogData> {
  const cacheKey = `gamelog:${sport}:${playerId}:${lastN}`;
  const cached = getCached<PlayerGamelogData>(cacheKey);
  if (cached) return cached;

  let url = `${STATS_SERVICE_URL}/players/${encodeURIComponent(playerId)}/gamelog?sport=${encodeURIComponent(sport)}&last_n=${lastN}`;
  if (playerName) {
    url += `&player_name=${encodeURIComponent(playerName)}`;
  }

  const response = await fetchWithRetry(
    url,
    0,
    10_000
  );
  const data = await response.json();
  const result = data.data ?? { games: [], season_averages: { games_played: 0 } };
  setCache(cacheKey, result, FINAL_CACHE_TTL);
  return result;
}
