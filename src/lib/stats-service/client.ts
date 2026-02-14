const STATS_SERVICE_URL =
  process.env.STATS_SERVICE_URL || "http://localhost:8000";
const TIMEOUT_MS = 3000;

// Module-level TTL cache for live endpoints (30s) and final boxscores (1hr)
const CACHE_TTL = 30_000;
const FINAL_CACHE_TTL = 3_600_000;
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

async function fetchWithRetry(
  url: string,
  retries = 1,
  timeout = TIMEOUT_MS
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        timeout
      );

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (response.ok) return response;

      if (response.status === 503 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      throw new StatsServiceError(
        `Stats service error: ${response.status}`,
        response.status
      );
    } catch (error) {
      if (error instanceof StatsServiceError) throw error;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw new StatsServiceError(
        `Stats service unavailable: ${error instanceof Error ? error.message : "Unknown error"}`,
        503
      );
    }
  }
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

export async function fetchBoxscore(
  gameId: string
): Promise<PlayerBoxScore[]> {
  const cacheKey = `boxscore:${gameId}`;
  const cached = getCached<PlayerBoxScore[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/games/${gameId}/boxscore`,
    0
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result, FINAL_CACHE_TTL);
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
    0
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
    0
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result, FINAL_CACHE_TTL);
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
    0
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result, FINAL_CACHE_TTL);
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
    0
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

export async function fetchSoccerBoxscoreLive(
  fixtureId: string
): Promise<PlayerBoxScore[]> {
  const cacheKey = `soccerBoxscoreLive:${fixtureId}`;
  const cached = getCached<PlayerBoxScore[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/soccer/games/${fixtureId}/boxscore/live`,
    0
  );
  const data = await response.json();
  const result = data.data ?? [];
  setCache(cacheKey, result);
  return result;
}
