import type { CardBuilderState, CardBuilderAction } from "./types";

export const initialCardBuilderState: CardBuilderState = {
  picks: [],
  maxPicks: 6,
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
      if (state.picks.length >= state.maxPicks) return state;
      if (state.picks.some((p) => p.prop_id === action.pick.prop_id))
        return state;
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
    case "SET_CHALLENGE":
      return {
        ...state,
        challengeId: action.challengeId,
        challengeOpponent: action.opponent,
      };
    case "SHOW_SUCCESS":
      return { ...state, showSuccess: true, isLocking: false };
    case "HIDE_SUCCESS":
      return { ...state, showSuccess: false };
  }
}
