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
import { logError } from "@/lib/logger";
import type { SportKey } from "./config";

/**
 * Format a Date for the sport's stats-service date parameter.
 * All sports now use ESPN (YYYYMMDD format).
 *
 * NOTE: The date is derived from the UTC representation of the game time.
 * ESPN indexes games by Eastern Time, so late-night ET games (after ~7 PM ET)
 * will have a UTC date one day ahead of the actual ESPN date.
 * Always use lookbackDatesForSport() when fetching ESPN data to cover both dates.
 */
export function formatDateForSport(_sport: string, date: Date): string {
  const iso = date.toISOString().slice(0, 10); // "YYYY-MM-DD"
  return iso.replace(/-/g, ""); // "YYYYMMDD"
}

/**
 * Return the date strings a lookback fetch should cover for a given game time.
 * All sports use ESPN which indexes by ET, so check today + yesterday to handle
 * UTC boundary edge cases.
 */
export function lookbackDatesForSport(sport: string, date: Date): string[] {
  const dates = [formatDateForSport(sport, date)];
  const dayBefore = new Date(date);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dates.push(formatDateForSport(sport, dayBefore));
  // Also check the day after — DB commence_time may be off by a day due to
  // timezone differences or stale data from the odds API.
  const dayAfter = new Date(date);
  dayAfter.setDate(dayAfter.getDate() + 1);
  dates.push(formatDateForSport(sport, dayAfter));
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
    logError("fetchers", `No boxscore fetcher mapped for "${sport}", falling back to NBA`);
  }
  return fetchBoxscore;
}
