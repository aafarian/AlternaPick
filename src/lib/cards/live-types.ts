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

/**
 * Convert a raw challenge pick (from Supabase query) into LivePickData shape.
 * Used when no live feed exists — pre-game or resolved picks.
 */
export function toLivePickData(pick: {
  id: string;
  selection: string;
  result: string;
  actual_value: number | null;
  prop: {
    id: string;
    player_name: string;
    player_id: string | null;
    stat_category: string;
    line: number;
    game_id: string;
  } | null;
}): LivePickData {
  return {
    pick_id: pick.id,
    player_name: pick.prop?.player_name ?? "Unknown",
    player_id: pick.prop?.player_id ?? null,
    stat_category: (pick.prop?.stat_category ?? "points") as StatCategory,
    line: pick.prop?.line ?? 0,
    selection: pick.selection as PickSelection,
    current_value: pick.actual_value,
    trending:
      pick.result === "hit" || pick.result === "miss" || pick.result === "push"
        ? pick.result
        : null,
    game_status: null,
  };
}

export interface LiveChallengeData {
  challenge_id: string;
  challenger_card: {
    card_id: string;
    picks: LivePickData[];
    has_live_games: boolean;
  } | null;
  opponent_card: {
    card_id: string;
    picks: LivePickData[];
    has_live_games: boolean;
  } | null;
  games: LiveGameStatus[];
  has_live_games: boolean;
}
