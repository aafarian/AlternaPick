"use client";

import type { LiveGameStatus } from "@/lib/cards/live-types";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/format";

export default function GameScoreBanner({ games }: { games: LiveGameStatus[] }) {
  if (games.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
      {games.map((game) => (
        <div
          key={game.nba_game_id}
          className="flex shrink-0 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-bold">{game.away_tricode}</span>
            <span className="text-lg font-black tabular-nums">{game.away_score}</span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            {game.status === "live" ? (
              <div className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span className="text-[10px] font-bold text-primary">
                  {formatClock(game.period, game.clock)}
                </span>
              </div>
            ) : (
              <span
                className={cn(
                  "text-[10px] font-bold uppercase",
                  game.status === "final"
                    ? "text-muted-foreground"
                    : "text-amber-400"
                )}
              >
                {game.status === "final" ? "Final" : "Pre-game"}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">vs</span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-bold">{game.home_tricode}</span>
            <span className="text-lg font-black tabular-nums">{game.home_score}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
