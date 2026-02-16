"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { StatCategory } from "@/lib/supabase/types";

export interface PlayerProfileTarget {
  playerId: string;
  playerName: string;
  playerTeam?: string | null;
  playerPosition?: string | null;
  sport?: string;
  propContext?: {
    line: number;
    statCategory: StatCategory;
  };
}

interface PlayerProfileContextValue {
  target: PlayerProfileTarget | null;
  isOpen: boolean;
  openProfile: (target: PlayerProfileTarget) => void;
  closeProfile: () => void;
}

const PlayerProfileContext = createContext<PlayerProfileContextValue | null>(
  null
);

export function PlayerProfileProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<PlayerProfileTarget | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openProfile = useCallback((t: PlayerProfileTarget) => {
    setTarget(t);
    setIsOpen(true);
  }, []);

  const closeProfile = useCallback(() => {
    setIsOpen(false);
    // Clear target after sheet close animation
    setTimeout(() => setTarget(null), 300);
  }, []);

  return (
    <PlayerProfileContext.Provider
      value={{ target, isOpen, openProfile, closeProfile }}
    >
      {children}
    </PlayerProfileContext.Provider>
  );
}

export function usePlayerProfile() {
  const ctx = useContext(PlayerProfileContext);
  if (!ctx) {
    throw new Error("usePlayerProfile must be used within PlayerProfileProvider");
  }
  return ctx;
}
