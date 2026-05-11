import type { GameMode, StatCategory } from "@/lib/supabase/types";

/** Hit-rate stats for a single stat category (points, rebounds, etc.) */
export interface CategoryStats {
  category: StatCategory;
  hits: number;
  total: number;
  rate: number;
}

/** Hit-rate stats for a single player */
export interface PlayerStats {
  player_name: string;
  player_id?: string | null;
  sport?: string;
  hits: number;
  total: number;
  rate: number;
}

/** Aggregated hit-rate stats for over/under selections */
export interface DirectionStats {
  over: { hits: number; total: number; rate: number };
  under: { hits: number; total: number; rate: number };
}

/** A single data point in the daily trend time series */
export interface TrendPoint {
  date: string;
  hits: number;
  total: number;
  rate: number;
}

/** Serializable map from key (stat_category or player_name) to hit rate */
export type EdgeMap = Record<string, number>;

// ---------- Enhanced Analytics Types (Phase 8) ----------

/** Hit-rate stats grouped by card size (2-6 picks) */
export interface CardSizeStats {
  cardSize: number;
  cards: number;
  hits: number;
  total: number;
  rate: number;
}

/** Hit-rate stats grouped by NBA team */
export interface TeamStats {
  team: string;
  hits: number;
  total: number;
  rate: number;
}

/** Score distribution entry: count of cards at a specific score for a card size */
export interface ScoreDistributionEntry {
  cardSize: number;
  score: number;
  count: number;
}

/** A single resolved card for the card history list */
export interface CardHistoryItem {
  id: string;
  score: number;
  totalPicks: number;
  cardSize: number;
  gameMode: GameMode;
  resolvedAt: string | null;
}

/** A single data point in the flame coin balance trend */
export interface CoinTrendPoint {
  date: string;
  balance: number;
  wager: number;
  payout: number;
}

/** Win-rate stats grouped by game mode */
export interface GameModeStats {
  mode: GameMode;
  cards: number;
  wins: number;
  winRate: number;
  avgScore: number;
}
