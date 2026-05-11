"use client";

import type { ReactNode } from "react";
import { useState, useCallback } from "react";
import type { Game, Prop } from "@/lib/supabase/types";
import { StaggerChildren, StaggerItem } from "@/components/motion";
import GameCard from "./GameCard";
import GameSelector from "./GameSelector";

type GameWithProps = Game & { props: Prop[] };

interface PropsGameListProps {
  games: GameWithProps[];
  /** Filter controls rendered inside the sticky header above the game selector */
  children?: ReactNode;
  /** When provided, game selector is rendered by parent — this component only renders cards */
  externalChip?: { activeId: string | null; onSelect: (id: string) => void };
}

export default function PropsGameList({
  games,
  children,
  externalChip,
}: PropsGameListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(games.map((g) => g.id))
  );
  const [activeChip, setActiveChip] = useState<string | null>(null);

  const toggleGame = useCallback((gameId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  }, []);

  const chipId = externalChip ? externalChip.activeId : activeChip;

  const handleChipSelect = useCallback((gameId: string) => {
    if (externalChip) {
      externalChip.onSelect(gameId);
    }

    // If tapping the already-active chip, deselect and expand all
    if (chipId === gameId) {
      if (!externalChip) setActiveChip(null);
      setExpandedIds(new Set(games.map((g) => g.id)));
      return;
    }

    // Expand the selected game
    if (!externalChip) setActiveChip(gameId);
    setExpandedIds((prev) => new Set([...prev, gameId]));

    // Scroll to it after a tick so the DOM has expanded
    requestAnimationFrame(() => {
      const el = document.getElementById(`game-${gameId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }, [chipId, externalChip, games]);

  const gameSelector = (
    <GameSelector
      games={games.map((g) => ({
        id: g.id,
        away_team: g.away_team,
        home_team: g.home_team,
        commence_time: g.commence_time,
      }))}
      activeId={chipId}
      onSelect={handleChipSelect}
    />
  );

  return (
    <>
      {/* Only render the selector inline when not externally managed */}
      {!externalChip && (
        <div className={children ? "sticky top-16 z-30 -mx-4 flex flex-col gap-2 overflow-x-hidden border-b border-white/5 bg-background/95 px-4 pb-2 pt-1.5 backdrop-blur-md" : ""}>
          {children}
          {gameSelector}
        </div>
      )}

      <StaggerChildren staggerDelay={0.06} className="mt-4 flex flex-col gap-3">
        {games.map((game) => (
          <StaggerItem key={game.id}>
            <GameCard
              game={game}
              expanded={expandedIds.has(game.id)}
              onToggle={() => toggleGame(game.id)}
            />
          </StaggerItem>
        ))}
      </StaggerChildren>
    </>
  );
}
