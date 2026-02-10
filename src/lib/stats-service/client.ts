const STATS_SERVICE_URL =
  process.env.STATS_SERVICE_URL || "http://localhost:8000";
const TIMEOUT_MS = 5000;

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
}

export interface NbaPlayer {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  team_abbreviation?: string;
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
  retries = 1
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        TIMEOUT_MS
      );

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

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
  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/games/${gameId}/boxscore`
  );
  const data = await response.json();
  return data.data ?? [];
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
  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/games/${gameId}/boxscore/live`
  );
  const data = await response.json();
  return data.data ?? [];
}

export async function fetchTodaysGamesLive(): Promise<StatsGame[]> {
  const response = await fetchWithRetry(
    `${STATS_SERVICE_URL}/games/today/live`
  );
  const data = await response.json();
  return data.data ?? [];
}
