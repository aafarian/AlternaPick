import type { StatCategory } from "@/lib/supabase/types";

export const ODDS_API_BASE_URL = "https://api.the-odds-api.com";
export const SPORT_KEY = "basketball_nba";
export const DEFAULT_REGION = "us";
export const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export const MARKETS = [
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes",
  "player_blocks",
  "player_steals",
  "player_turnovers",
  "player_points_rebounds_assists",
  "player_points_rebounds",
  "player_points_assists",
  "player_rebounds_assists",
  "player_blocks_steals",
] as const;

export type MarketKey = (typeof MARKETS)[number];

export const MARKET_TO_STAT_CATEGORY: Record<MarketKey, StatCategory> = {
  player_points: "points",
  player_rebounds: "rebounds",
  player_assists: "assists",
  player_threes: "threes",
  player_blocks: "blocks",
  player_steals: "steals",
  player_turnovers: "turnovers",
  player_points_rebounds_assists: "pra",
  player_points_rebounds: "pts_reb",
  player_points_assists: "pts_ast",
  player_rebounds_assists: "reb_ast",
  player_blocks_steals: "blk_stl",
};
