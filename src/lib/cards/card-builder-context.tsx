"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import type {
  CardBuilderPick,
  CardBuilderState,
  ChallengeOpponent,
} from "./types";
import type { PickSelection } from "@/lib/supabase/types";
import {
  cardBuilderReducer,
  initialCardBuilderState,
} from "./card-builder-reducer";

interface CardBuilderContextValue {
  state: CardBuilderState;
  addPick: (pick: CardBuilderPick) => void;
  removePick: (propId: string) => void;
  toggleSelection: (propId: string) => void;
  clearCard: () => void;
  setLocking: (isLocking: boolean) => void;
  setError: (error: string | null) => void;
  setChallenge: (challengeId: string, opponent: ChallengeOpponent) => void;
  isPickSelected: (propId: string) => boolean;
  getSelection: (propId: string) => PickSelection | null;
  showSuccess: () => void;
  hideSuccess: () => void;
  isFull: boolean;
}

const CardBuilderContext = createContext<CardBuilderContextValue | null>(null);

export function CardBuilderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    cardBuilderReducer,
    initialCardBuilderState
  );

  const addPick = useCallback(
    (pick: CardBuilderPick) => dispatch({ type: "ADD_PICK", pick }),
    []
  );

  const removePick = useCallback(
    (propId: string) => dispatch({ type: "REMOVE_PICK", prop_id: propId }),
    []
  );

  const toggleSelection = useCallback(
    (propId: string) => {
      const pick = state.picks.find((p) => p.prop_id === propId);
      if (!pick) return;
      const newSelection: PickSelection =
        pick.selection === "over" ? "under" : "over";
      dispatch({
        type: "SET_SELECTION",
        prop_id: propId,
        selection: newSelection,
      });
    },
    [state.picks]
  );

  const clearCard = useCallback(() => dispatch({ type: "CLEAR_CARD" }), []);

  const setLocking = useCallback(
    (isLocking: boolean) => dispatch({ type: "SET_LOCKING", isLocking }),
    []
  );

  const setError = useCallback(
    (error: string | null) => dispatch({ type: "SET_ERROR", error }),
    []
  );

  const setChallenge = useCallback(
    (challengeId: string, opponent: ChallengeOpponent) =>
      dispatch({ type: "SET_CHALLENGE", challengeId, opponent }),
    []
  );

  const showSuccessFn = useCallback(
    () => dispatch({ type: "SHOW_SUCCESS" }),
    []
  );

  const hideSuccessFn = useCallback(
    () => dispatch({ type: "HIDE_SUCCESS" }),
    []
  );

  const isPickSelected = useCallback(
    (propId: string) => state.picks.some((p) => p.prop_id === propId),
    [state.picks]
  );

  const getSelection = useCallback(
    (propId: string): PickSelection | null => {
      const pick = state.picks.find((p) => p.prop_id === propId);
      return pick?.selection ?? null;
    },
    [state.picks]
  );

  const isFull = state.picks.length >= state.maxPicks;

  return (
    <CardBuilderContext.Provider
      value={{
        state,
        addPick,
        removePick,
        toggleSelection,
        clearCard,
        setLocking,
        setError,
        setChallenge,
        isPickSelected,
        getSelection,
        showSuccess: showSuccessFn,
        hideSuccess: hideSuccessFn,
        isFull,
      }}
    >
      {children}
    </CardBuilderContext.Provider>
  );
}

export function useCardBuilder(): CardBuilderContextValue {
  const context = useContext(CardBuilderContext);
  if (!context) {
    throw new Error("useCardBuilder must be used within a CardBuilderProvider");
  }
  return context;
}
