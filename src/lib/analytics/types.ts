import type { StatCategory } from "@/lib/supabase/types";

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
