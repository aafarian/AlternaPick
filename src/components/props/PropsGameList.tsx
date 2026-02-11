"use client";

import { useState, useCallback } from "react";
import type { Game, Prop } from "@/lib/supabase/types";
import type { EdgeMap } from "@/lib/analytics/types";
import GameCard from "./GameCard";
import GameSelector from "./GameSelector";

type GameWithProps = Game & { props: Prop[] };

interface PropsGameListProps {
  games: GameWithProps[];
  /** When true, only the first game starts expanded; rest collapsed. */
  expandFirstOnly: boolean;
  /** Category-level edge rates (rate >= 0.65, total >= 5) */
  categoryEdges?: EdgeMap;
  /** Player-level edge rates (rate >= 0.65, total >= 5) */
  playerEdges?: EdgeMap;
}

export default function PropsGameList({
  games,
  expandFirstOnly,
  categoryEdges = {},
  playerEdges = {},
}: PropsGameListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (expandFirstOnly && games.length > 0) {
      return new Set([games[0].id]);
    }
    return new Set(games.map((g) => g.id));
  });
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
    // If tapping the already-active chip, deselect and reset to initial state
    if (activeChip === gameId) {
      setActiveChip(null);
      if (expandFirstOnly && games.length > 0) {
        setExpandedIds(new Set([games[0].id]));
      } else {
        setExpandedIds(new Set(games.map((g) => g.id)));
      }
      return;
    }

    // Expand the selected game (collapse others if in expandFirstOnly mode)
    setActiveChip(gameId);
    if (expandFirstOnly) {
      setExpandedIds(new Set([gameId]));
    } else {
      setExpandedIds((prev) => new Set([...prev, gameId]));
    }

    // Scroll to it after a tick so the DOM has expanded
    requestAnimationFrame(() => {
      const el = document.getElementById(`game-${gameId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }, [activeChip, expandFirstOnly, games]);

  return (
    <>
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

      <div className="mt-4 flex flex-col gap-3">
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            expanded={expandedIds.has(game.id)}
            onToggle={() => toggleGame(game.id)}
            categoryEdges={categoryEdges}
            playerEdges={playerEdges}
          />
        ))}
      </div>
    </>
  );
}
