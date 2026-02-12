import type { StatCategory, PickSelection } from "@/lib/supabase/types";
import type { GameMode } from "@/lib/modes/types";

export interface CardBuilderPick {
  prop_id: string;
  player_name: string;
  player_team: string;
  stat_category: StatCategory;
  line: number;
  selection: PickSelection;
  game_id: string;
}

export interface ChallengeOpponent {
  username: string;
  display_name: string | null;
}

export interface CardBuilderState {
  picks: CardBuilderPick[];
  maxPicks: number;
  gameMode: GameMode;
  cardSize: number;
  isLocking: boolean;
  error: string | null;
  challengeId: string | null;
  challengeOpponent: ChallengeOpponent | null;
  showSuccess: boolean;
}

export type CardBuilderAction =
  | { type: "ADD_PICK"; pick: CardBuilderPick }
  | { type: "REMOVE_PICK"; prop_id: string }
  | { type: "SET_SELECTION"; prop_id: string; selection: PickSelection }
  | { type: "CLEAR_CARD" }
  | { type: "SET_LOCKING"; isLocking: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | {
      type: "SET_CHALLENGE";
      challengeId: string;
      opponent: ChallengeOpponent;
      gameMode?: GameMode;
      cardSize?: number;
    }
  | { type: "SHOW_SUCCESS" }
  | { type: "HIDE_SUCCESS" }
  | { type: "SET_MODE"; mode: GameMode }
  | { type: "SET_CARD_SIZE"; size: number };
