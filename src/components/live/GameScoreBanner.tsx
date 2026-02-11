"use client";

import type { LiveGameStatus } from "@/lib/cards/live-types";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/format";

export default function GameScoreBanner({ games }: { games: LiveGameStatus[] }) {
  if (games.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {games.map((game) => (
        <div
          key={game.nba_game_id}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-secondary/40 px-3 py-1.5"
        >
          <span className="text-[11px] font-semibold tabular-nums">
            {game.away_tricode} {game.away_score}
          </span>

          {game.status === "live" ? (
            <div className="flex items-center gap-1">
              <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-foreground" />
              <span className="text-[10px] font-medium text-foreground/80">
                {formatClock(game.period, game.clock)}
              </span>
            </div>
          ) : (
            <span
              className={cn(
                "text-[10px] font-medium",
                game.status === "final"
                  ? "text-muted-foreground"
                  : "text-muted-foreground/60"
              )}
            >
              {game.status === "final" ? "F" : "—"}
            </span>
          )}

          <span className="text-[11px] font-semibold tabular-nums">
            {game.home_tricode} {game.home_score}
          </span>
        </div>
      ))}
    </div>
  );
}
