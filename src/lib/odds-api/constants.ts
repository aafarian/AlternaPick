import type { StatCategory } from "@/lib/supabase/types";

export const ODDS_API_BASE_URL = "https://api.the-odds-api.com";
export const DEFAULT_REGION = "us";
export const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export type SportKey = "nba" | "epl" | "ncaab";

export const SPORT_CONFIGS: Record<SportKey, {
  oddsApiKey: string;
  markets: readonly string[];
  marketToCategory: Record<string, StatCategory>;
}> = {
  nba: {
    oddsApiKey: "basketball_nba",
    markets: [
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
    ],
    marketToCategory: {
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
    },
  },
  epl: {
    oddsApiKey: "soccer_epl",
    markets: [
      "player_shots",
      "player_shots_on_target",
      "player_assists",
      "player_goal_scorer_anytime",
    ],
    marketToCategory: {
      player_shots: "shots",
      player_shots_on_target: "shots_on_target",
      player_assists: "assists",
      player_goal_scorer_anytime: "goals",
    },
  },
  ncaab: {
    oddsApiKey: "basketball_ncaab",
    markets: [
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
    ],
    marketToCategory: {
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
    },
  },
};

// Backward-compatible aliases (default to NBA)
export const SPORT_KEY = SPORT_CONFIGS.nba.oddsApiKey;
export const MARKETS = SPORT_CONFIGS.nba.markets;
export const MARKET_TO_STAT_CATEGORY = SPORT_CONFIGS.nba.marketToCategory;

export type MarketKey = (typeof MARKETS)[number];
