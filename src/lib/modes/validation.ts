import type { GameMode, PickValidationInput, PickValidationResult } from "./types";
import { GAME_MODES } from "./definitions";

/**
 * Validate an array of picks against the constraints of a game mode.
 *
 * Used by both the client-side card builder (to give instant feedback)
 * and the server-side card creation API (to enforce rules).
 *
 * For modes without pick-level constraints (classic, sabotage, mirror)
 * this always returns `{ valid: true }`.
 */
export function validatePicksForMode(
  picks: PickValidationInput[],
  mode: GameMode
): PickValidationResult {
  if (picks.length === 0) {
    return { valid: true };
  }

  const { constraints } = GAME_MODES[mode];

  // --- one_player: all picks must reference the same player_name ---
  if (constraints.samePlayer) {
    const firstName = picks[0].player_name;
    const different = picks.find((p) => p.player_name !== firstName);
    if (different) {
      return {
        valid: false,
        error: `One Player mode requires all picks from the same player. ` +
          `Found "${firstName}" and "${different.player_name}".`,
      };
    }
  }

  // --- one_team: all picks must reference the same player_team ---
  if (constraints.sameTeam) {
    const firstTeam = picks[0].player_team;
    if (!firstTeam) {
      return {
        valid: false,
        error: "One Team mode requires team information on every pick.",
      };
    }
    const different = picks.find((p) => p.player_team !== firstTeam);
    if (different) {
      return {
        valid: false,
        error: `One Team mode requires all picks from the same team. ` +
          `Found "${firstTeam}" and "${different.player_team}".`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate a single incoming pick against the existing picks for a mode.
 *
 * Useful for the card builder to check each new pick incrementally rather
 * than re-validating the entire array.
 */
export function validateIncomingPick(
  existingPicks: PickValidationInput[],
  newPick: PickValidationInput,
  mode: GameMode
): PickValidationResult {
  if (existingPicks.length === 0) {
    return { valid: true };
  }

  const { constraints } = GAME_MODES[mode];

  if (constraints.samePlayer) {
    const requiredPlayer = existingPicks[0].player_name;
    if (newPick.player_name !== requiredPlayer) {
      return {
        valid: false,
        error: `One Player mode: all picks must be from "${requiredPlayer}".`,
      };
    }
  }

  if (constraints.sameTeam) {
    const requiredTeam = existingPicks[0].player_team;
    if (newPick.player_team !== requiredTeam) {
      return {
        valid: false,
        error: `One Team mode: all picks must be from "${requiredTeam}".`,
      };
    }
  }

  return { valid: true };
}

/**
 * For mirror mode, the challenged player cannot choose custom props --
 * they must pick over/under on the shared set. This helper returns
 * true when the mode disallows free prop selection by the second player.
 */
export function isCustomSelectionDisabled(mode: GameMode): boolean {
  return GAME_MODES[mode].constraints.sharedProps === true;
}
