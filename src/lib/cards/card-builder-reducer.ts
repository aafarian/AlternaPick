import type { CardBuilderState, CardBuilderAction } from "./types";
import { DEFAULT_CARD_SIZE } from "@/lib/modes/types";
import { validateIncomingPick, validatePicksForMode } from "@/lib/modes/validation";
import { getModeConfig } from "@/lib/modes/definitions";

export const initialCardBuilderState: CardBuilderState = {
  picks: [],
  maxPicks: DEFAULT_CARD_SIZE,
  gameMode: "classic",
  cardSize: DEFAULT_CARD_SIZE,
  isLocking: false,
  error: null,
  challengeId: null,
  challengeOpponent: null,
  showSuccess: false,
};

export function cardBuilderReducer(
  state: CardBuilderState,
  action: CardBuilderAction
): CardBuilderState {
  switch (action.type) {
    case "ADD_PICK": {
      if (state.picks.length >= state.cardSize) return state;
      if (state.picks.some((p) => p.prop_id === action.pick.prop_id))
        return state;

      // Only enforce mode constraints when picking for an existing challenge
      // (regular cards: mode is chosen later at challenge/submit time)
      if (state.challengeId) {
        const validation = validateIncomingPick(
          state.picks.map((p) => ({
            player_name: p.player_name,
            player_team: p.player_team,
          })),
          {
            player_name: action.pick.player_name,
            player_team: action.pick.player_team,
          },
          state.gameMode
        );
        if (!validation.valid) {
          return { ...state, error: validation.error ?? "Pick violates mode constraints" };
        }
      }

      return { ...state, picks: [...state.picks, action.pick], error: null };
    }
    case "REMOVE_PICK":
      return {
        ...state,
        picks: state.picks.filter((p) => p.prop_id !== action.prop_id),
        error: null,
      };
    case "SET_SELECTION":
      return {
        ...state,
        picks: state.picks.map((p) =>
          p.prop_id === action.prop_id
            ? { ...p, selection: action.selection }
            : p
        ),
      };
    case "CLEAR_CARD":
      return { ...initialCardBuilderState };
    case "SET_LOCKING":
      return { ...state, isLocking: action.isLocking };
    case "SET_ERROR":
      return { ...state, error: action.error, isLocking: false };
    case "SET_CHALLENGE": {
      const newSize = action.cardSize ?? state.cardSize;
      return {
        ...state,
        challengeId: action.challengeId,
        challengeOpponent: action.opponent,
        gameMode: action.gameMode ?? state.gameMode,
        cardSize: newSize,
        maxPicks: newSize,
      };
    }
    case "SHOW_SUCCESS":
      return { ...state, showSuccess: true, isLocking: false };
    case "HIDE_SUCCESS":
      return { ...state, showSuccess: false };

    case "SET_MODE": {
      const newMode = action.mode;
      if (newMode === state.gameMode) return state;

      // Validate existing picks against the new mode constraints
      const modeConfig = getModeConfig(newMode);
      let filteredPicks = state.picks;

      if (modeConfig.constraints.samePlayer && filteredPicks.length > 0) {
        // Keep only picks matching the first pick's player
        const anchor = filteredPicks[0].player_name;
        filteredPicks = filteredPicks.filter((p) => p.player_name === anchor);
      } else if (modeConfig.constraints.sameTeam && filteredPicks.length > 0) {
        // Keep only picks matching the first pick's team
        const anchor = filteredPicks[0].player_team;
        filteredPicks = filteredPicks.filter((p) => p.player_team === anchor);
      }

      // Final validation pass to ensure remaining picks are valid
      const result = validatePicksForMode(
        filteredPicks.map((p) => ({
          player_name: p.player_name,
          player_team: p.player_team,
        })),
        newMode
      );
      if (!result.valid) {
        filteredPicks = [];
      }

      // Trim if filtered picks exceed card size
      if (filteredPicks.length > state.cardSize) {
        filteredPicks = filteredPicks.slice(0, state.cardSize);
      }

      return {
        ...state,
        gameMode: newMode,
        picks: filteredPicks,
        error: null,
      };
    }

    case "SET_CARD_SIZE": {
      const newSize = action.size;
      const trimmedPicks =
        state.picks.length > newSize
          ? state.picks.slice(0, newSize)
          : state.picks;

      return {
        ...state,
        cardSize: newSize,
        maxPicks: newSize,
        picks: trimmedPicks,
        error: null,
      };
    }
  }
}
