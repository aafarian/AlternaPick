import type { StatCategory, PickSelection } from "@/lib/supabase/types";

export interface LiveGameStatus {
  game_id: string;
  nba_game_id: string;
  status: "scheduled" | "live" | "final";
  period: number;
  clock: string;
  home_team: string;
  away_team: string;
  home_tricode: string;
  away_tricode: string;
  home_score: number;
  away_score: number;
}

export interface LivePickData {
  pick_id: string;
  player_name: string;
  player_id: string | null;
  stat_category: StatCategory;
  line: number;
  selection: PickSelection;
  current_value: number | null;
  trending: "hit" | "miss" | "push" | null;
  game_status: LiveGameStatus | null;
}

export interface LiveCardData {
  card_id: string;
  picks: LivePickData[];
  has_live_games: boolean;
  games: LiveGameStatus[];
}
