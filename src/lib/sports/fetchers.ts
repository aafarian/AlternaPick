/**
 * Server-only boxscore fetcher routing.
 * Kept separate from config.ts to avoid pulling stats-service into client bundles.
 */
import {
  fetchBoxscore,
  fetchSoccerBoxscore,
  fetchNcaabBoxscore,
  type PlayerBoxScore,
} from "@/lib/stats-service/client";
import type { SportKey } from "./config";

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
    console.warn(`[getBoxscoreFetcher] No fetcher mapped for "${sport}", falling back to NBA`);
  }
  return fetchBoxscore;
}
