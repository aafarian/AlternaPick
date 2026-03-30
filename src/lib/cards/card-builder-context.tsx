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
import type { GameMode } from "@/lib/modes/types";
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
  setChallenge: (challengeId: string, opponent: ChallengeOpponent, gameMode?: GameMode, cardSize?: number, guestToken?: string) => void;
  setMode: (mode: GameMode) => void;
  setCardSize: (size: number) => void;
  isPickSelected: (propId: string) => boolean;
  getSelection: (propId: string) => PickSelection | null;
  showSuccess: () => void;
  hideSuccess: () => void;
  isFull: boolean;
  canLockIn: boolean;
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
    (challengeId: string, opponent: ChallengeOpponent, gameMode?: GameMode, cardSize?: number, guestToken?: string) =>
      dispatch({ type: "SET_CHALLENGE", challengeId, opponent, gameMode, cardSize, guestToken }),
    []
  );

  const setMode = useCallback(
    (mode: GameMode) => dispatch({ type: "SET_MODE", mode }),
    []
  );

  const setCardSize = useCallback(
    (size: number) => dispatch({ type: "SET_CARD_SIZE", size }),
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

  const isFull = state.picks.length >= state.cardSize;
  // Constrained challenge: opponent must match the challenger's exact pick count.
  // Unconstrained (challenger or solo): lock in with 2+ picks.
  const canLockIn = state.challengeId && state.cardSizeConstrained
    ? state.picks.length === state.cardSize
    : state.picks.length >= 2;

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
        setMode,
        setCardSize,
        isPickSelected,
        getSelection,
        showSuccess: showSuccessFn,
        hideSuccess: hideSuccessFn,
        isFull,
        canLockIn,
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
