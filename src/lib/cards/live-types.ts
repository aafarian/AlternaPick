import type { StatCategory, PickSelection } from "@/lib/supabase/types";
import { usesHalves } from "@/lib/sports/config";

export interface LiveGameStatus {
  game_id: string;
  external_event_id: string;
  status: "scheduled" | "live" | "final";
  period: number;
  clock: string;
  sport?: string;
  home_team: string;
  away_team: string;
  home_tricode: string;
  away_tricode: string;
  home_score: number;
  away_score: number;
  /** Pre-computed logo URLs (server-side, avoids client NCAAB ID issues) */
  home_logo?: string;
  away_logo?: string;
  /** ISO 8601 start time — used to show "Today 7:00 PM" for scheduled games */
  commence_time: string | null;
  /** Link to the game on nba.com / espn.com */
  game_url?: string;
}

export interface LivePickData {
  pick_id: string;
  player_name: string;
  player_id: string | null;
  player_team: string | null;
  player_position: string | null;
  sport?: string;
  stat_category: StatCategory;
  line: number;
  selection: PickSelection;
  current_value: number | null;
  trending: "hit" | "miss" | "push" | "dnp" | null;
  game_status: LiveGameStatus | null;
  /** Notch tier (-2 to +3). 0 = Standard. */
  notch?: number;
  /** Per-pick HeatScore contribution (only set on resolved picks). */
  heat_score?: number | null;
}

export interface LiveCardData {
  card_id: string;
  picks: LivePickData[];
  has_live_games: boolean;
  /** True when every game on the card has definitively reached "final" status */
  all_games_final: boolean;
  games: LiveGameStatus[];
  /** True when the card was resolved during this request */
  card_resolved?: boolean;
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
    player_team?: string | null;
    player_position?: string | null;
    stat_category: string;
    line: number;
    game_id: string;
    games?: { sport: string; commence_time?: string | null };
  } | null;
}): LivePickData {
  const hasResult =
    pick.result === "hit" || pick.result === "miss" || pick.result === "push" || pick.result === "dnp";

  const gameId = pick.prop?.game_id ?? "";
  const sport = pick.prop?.games?.sport ?? "";

  // Build game_status for both resolved and pre-game picks.
  // Returning null causes isAwaitingLive=true in computePickDisplay, showing
  // a loading spinner — use "scheduled" for pre-game picks instead.
  let gameStatus: LivePickData["game_status"];
  if (hasResult) {
    gameStatus = {
      game_id: gameId,
      external_event_id: gameId,
      status: "final" as const,
      period: usesHalves(sport) ? 2 : 4,
      clock: "0:00",
      home_team: "",
      away_team: "",
      home_tricode: "",
      away_tricode: "",
      home_score: 0,
      away_score: 0,
      commence_time: null,
    };
  } else {
    gameStatus = {
      game_id: gameId,
      external_event_id: gameId,
      status: "scheduled" as const,
      period: 0,
      clock: "",
      home_team: "",
      away_team: "",
      home_tricode: "",
      away_tricode: "",
      home_score: 0,
      away_score: 0,
      commence_time: pick.prop?.games?.commence_time ?? null,
    };
  }

  return {
    pick_id: pick.id,
    player_name: pick.prop?.player_name ?? "Unknown",
    player_id: pick.prop?.player_id ?? null,
    player_team: pick.prop?.player_team ?? null,
    player_position: pick.prop?.player_position ?? null,
    sport: pick.prop?.games?.sport,
    stat_category: (pick.prop?.stat_category ?? "points") as StatCategory,
    line: pick.prop?.line ?? 0,
    selection: pick.selection as PickSelection,
    current_value: pick.actual_value,
    trending: hasResult ? (pick.result as "hit" | "miss" | "push" | "dnp") : null,
    game_status: gameStatus,
  };
}

/** Per-participant live data returned for group challenges. */
export interface LiveParticipantData {
  user_id: string | null;
  username: string | null;
  email: string | null;
  card: {
    card_id: string;
    picks: LivePickData[];
    has_live_games: boolean;
    all_games_final: boolean;
  } | null;
  placement?: number;
  status: string;
}

export interface LiveChallengeData {
  challenge_id: string;
  /** Present for 1v1 challenges (backward compat). Null for group challenges. */
  challenger_card: {
    card_id: string;
    picks: LivePickData[];
    has_live_games: boolean;
    all_games_final: boolean;
  } | null;
  /** Present for 1v1 challenges (backward compat). Null for group challenges. */
  opponent_card: {
    card_id: string;
    picks: LivePickData[];
    has_live_games: boolean;
    all_games_final: boolean;
  } | null;
  /** Present for group challenges — live data for each participant. */
  participants?: LiveParticipantData[];
  games: LiveGameStatus[];
  has_live_games: boolean;
  /** True when every game across all cards has definitively reached "final" status */
  all_games_final: boolean;
  /** True when cards/challenge were resolved during this request */
  challenge_resolved?: boolean;
}
