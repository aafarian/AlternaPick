/**
 * Game Mode type definitions for SportsTower.
 *
 * Modes are defined entirely in code (not DB). The `game_mode` column
 * on `cards` and `challenges` stores the mode key as a plain string.
 */

// ---- Core union type ----

export type GameMode =
  | "classic"
  | "sabotage"
  | "mirror"
  | "one_player"
  | "one_team";

// ---- Mode constraints ----

export interface ModeConstraints {
  /** All picks must reference the same player_name */
  samePlayer?: boolean;
  /** All picks must reference the same player_team */
  sameTeam?: boolean;
  /** Cards swap user_id when both are locked (sabotage) */
  swapCards?: boolean;
  /** Both players see/pick from the same prop set (mirror) */
  sharedProps?: boolean;
}

// ---- Mode definition ----

export interface GameModeDefinition {
  key: GameMode;
  displayName: string;
  description: string;
  /** Emoji icon for UI badges / selectors */
  icon: string;
  /** Human-readable rules text (1-3 sentences) */
  rules: string;
  constraints: ModeConstraints;
}

// ---- Pick validation input ----

export interface PickValidationInput {
  player_name: string;
  player_team: string;
}

// ---- Validation result ----

export interface PickValidationResult {
  valid: boolean;
  error?: string;
}

// ---- Card sizes ----

export const CARD_SIZES = [2, 3, 4, 5, 6] as const;
export type CardSize = (typeof CARD_SIZES)[number];
export const DEFAULT_CARD_SIZE: CardSize = 6;
export const MIN_CARD_SIZE = 2;
export const MAX_CARD_SIZE = 6;
