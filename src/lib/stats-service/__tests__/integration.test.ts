import { describe, it, expect } from "vitest";
import { formatDateForSport } from "@/lib/sports/fetchers";

const STATS_URL = process.env.STATS_SERVICE_URL || "http://localhost:8000";

let serviceAvailable = false;
if (process.env.STATS_SERVICE_URL) {
  try {
    const r = await fetch(`${STATS_URL}/games/today`, {
      signal: AbortSignal.timeout(500),
    });
    if (r.ok) {
      const body = await r.json();
      serviceAvailable = Array.isArray(body);
    }
  } catch {
    /* service not reachable or returned non-JSON */
  }
}

describe.runIf(serviceAvailable)("stats service integration", () => {
  const today = new Date();

  // --- NBA ---

  it("NBA /games/today returns valid StatsGame[] shape", async () => {
    const r = await fetch(`${STATS_URL}/games/today`);
    expect(r.ok).toBe(true);
    const games = await r.json();
    expect(Array.isArray(games)).toBe(true);
    if (games.length > 0) {
      const g = games[0];
      expect(g).toHaveProperty("game_id");
      expect(g).toHaveProperty("home_team");
      expect(g).toHaveProperty("away_team");
      expect(g).toHaveProperty("status");
    }
  });

  it("NBA /games?date= accepts YYYYMMDD format", async () => {
    const dateStr = formatDateForSport("nba", today);
    const r = await fetch(`${STATS_URL}/games?date=${dateStr}`);
    expect(r.ok).toBe(true);
    const games = await r.json();
    expect(Array.isArray(games)).toBe(true);
  });

  // --- EPL ---

  it("EPL /soccer/games/today returns valid shape", async () => {
    const r = await fetch(`${STATS_URL}/soccer/games/today`);
    expect(r.ok).toBe(true);
    const games = await r.json();
    expect(Array.isArray(games)).toBe(true);
    if (games.length > 0) {
      const g = games[0];
      expect(g).toHaveProperty("game_id");
      expect(g).toHaveProperty("home_team");
      expect(g).toHaveProperty("away_team");
    }
  });

  it("EPL /soccer/games accepts YYYYMMDD date param", async () => {
    const dateStr = formatDateForSport("epl", today);
    const r = await fetch(`${STATS_URL}/soccer/games?date=${dateStr}`);
    expect(r.ok).toBe(true);
    const games = await r.json();
    expect(Array.isArray(games)).toBe(true);
  });

  // --- La Liga ---

  it("La Liga /soccer/games/today?league=la_liga returns valid shape", async () => {
    const r = await fetch(`${STATS_URL}/soccer/games/today?league=la_liga`);
    expect(r.ok).toBe(true);
    const games = await r.json();
    expect(Array.isArray(games)).toBe(true);
  });

  // --- NCAAB ---

  it("NCAAB /ncaab/games/today returns valid shape", async () => {
    const r = await fetch(`${STATS_URL}/ncaab/games/today`);
    expect(r.ok).toBe(true);
    const games = await r.json();
    expect(Array.isArray(games)).toBe(true);
    if (games.length > 0) {
      const g = games[0];
      expect(g).toHaveProperty("game_id");
      expect(g).toHaveProperty("home_team");
      expect(g).toHaveProperty("away_team");
    }
  });

  // --- Boxscore shape ---

  it("NBA boxscore contains PlayerBoxScore fields when game has data", async () => {
    const gamesRes = await fetch(`${STATS_URL}/games/today`);
    const games = await gamesRes.json();
    const finalGame = games.find(
      (g: { status: string }) => g.status === "final",
    );
    if (!finalGame) {
      // No final games today — nothing to validate, skip gracefully
      console.warn("[integration] No final NBA games today, skipping boxscore shape check");
      return;
    }

    const r = await fetch(`${STATS_URL}/boxscore/${finalGame.game_id}`);
    expect(r.ok).toBe(true);
    const players = await r.json();
    expect(Array.isArray(players)).toBe(true);
    if (players.length > 0) {
      const p = players[0];
      expect(p).toHaveProperty("player_name");
      expect(p).toHaveProperty("points");
      expect(p).toHaveProperty("rebounds");
      expect(p).toHaveProperty("assists");
    }
  });
});
