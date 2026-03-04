/**
 * Server-only sport-specific helpers.
 * Kept separate from config.ts to avoid pulling stats-service into client bundles.
 */
import {
  fetchBoxscore,
  fetchSoccerBoxscore,
  fetchNcaabBoxscore,
  type PlayerBoxScore,
} from "@/lib/stats-service/client";
import type { SportKey } from "./config";
import { isSoccer } from "./config";

/**
 * Format a Date for the sport's stats-service date parameter.
 * ESPN-backed sports (NBA, NCAAB) use YYYYMMDD.
 * API-Football-backed sports (EPL, La Liga) use YYYY-MM-DD.
 */
export function formatDateForSport(sport: string, date: Date): string {
  const iso = date.toISOString().slice(0, 10); // "YYYY-MM-DD"
  if (isSoccer(sport)) return iso;
  return iso.replace(/-/g, ""); // "YYYYMMDD"
}

/**
 * Return the date strings a lookback fetch should cover for a given game time.
 * ESPN-backed sports also check the day before to handle UTC boundary edge cases.
 * Soccer (API-Football) uses UTC dates natively, so one date suffices.
 */
export function lookbackDatesForSport(sport: string, date: Date): string[] {
  const dates = [formatDateForSport(sport, date)];
  if (!isSoccer(sport)) {
    const dayBefore = new Date(date);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dates.push(formatDateForSport(sport, dayBefore));
  }
  return dates;
}

type BoxscoreFetcher = (eventId: string) => Promise<PlayerBoxScore[]>;

const FETCHER_MAP: Partial<Record<SportKey, BoxscoreFetcher>> = {
  epl: fetchSoccerBoxscore,
  la_liga: fetchSoccerBoxscore,
  ncaab: fetchNcaabBoxscore,
};

/** Returns the appropriate boxscore fetcher for a sport, defaulting to NBA. */
export function getBoxscoreFetcher(sport?: string | null): BoxscoreFetcher {
  if (sport && sport in FETCHER_MAP) {
    return FETCHER_MAP[sport as SportKey]!;
  }
  if (sport && sport !== "nba") {
    // Warn-level: not an operational error, just an unmapped sport falling back
    console.warn(`[getBoxscoreFetcher] No fetcher mapped for "${sport}", falling back to NBA`);
  }
  return fetchBoxscore;
}
