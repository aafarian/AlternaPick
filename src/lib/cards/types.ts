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
}

/** Stored when the user configures a challenge in the modal but hasn't locked in yet. */
export interface PendingChallenge {
  opponents: Array<{ user_id?: string; email?: string }>;
  opponentLabel: string;
  message: string;
}

export interface CardBuilderState {
  picks: CardBuilderPick[];
  maxPicks: number;
  gameMode: GameMode;
  cardSize: number;
  /** When true, the user must pick exactly cardSize props (opponent matching challenger). */
  cardSizeConstrained: boolean;
  isLocking: boolean;
  error: string | null;
  challengeId: string | null;
  challengeOpponent: ChallengeOpponent | null;
  /** Challenge intent not yet created on the server — created at lock-in. */
  pendingChallenge: PendingChallenge | null;
  /** Guest token for email-invite challenges (unauthenticated flow) */
  guestToken: string | null;
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
      guestToken?: string;
    }
  | {
      type: "SET_PENDING_CHALLENGE";
      pendingChallenge: PendingChallenge;
      gameMode: GameMode;
    }
  | { type: "SHOW_SUCCESS" }
  | { type: "HIDE_SUCCESS" }
  | { type: "SET_MODE"; mode: GameMode }
  | { type: "SET_CARD_SIZE"; size: number };
