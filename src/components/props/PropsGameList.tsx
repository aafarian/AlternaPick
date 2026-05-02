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
}

export default function PropsGameList({
  games,
  children,
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

  const handleChipSelect = useCallback((gameId: string) => {
    // If tapping the already-active chip, deselect and expand all
    if (activeChip === gameId) {
      setActiveChip(null);
      setExpandedIds(new Set(games.map((g) => g.id)));
      return;
    }

    // Expand the selected game
    setActiveChip(gameId);
    setExpandedIds((prev) => new Set([...prev, gameId]));

    // Scroll to it after a tick so the DOM has expanded
    requestAnimationFrame(() => {
      const el = document.getElementById(`game-${gameId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }, [activeChip, games]);

  return (
    <>
      <div className="sticky top-16 z-30 -mx-4 flex flex-col gap-2 overflow-x-hidden border-b border-border bg-background px-4 pb-2 pt-1.5 shadow-sm">
        {children}
        <GameSelector
          games={games.map((g) => ({
            id: g.id,
            away_team: g.away_team,
            home_team: g.home_team,
            commence_time: g.commence_time,
          }))}
          activeId={activeChip}
          onSelect={handleChipSelect}
        />
      </div>

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
