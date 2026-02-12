"use client";

import type { LiveGameStatus } from "@/lib/cards/live-types";
import { formatClock, formatGameTime } from "@/lib/format";

export default function GameScoreBanner({ games }: { games: LiveGameStatus[] }) {
  if (games.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {games.map((game) => {
        const isScheduled = game.status === "scheduled";
        const isLive = game.status === "live";

        return (
          <div
            key={game.nba_game_id}
            className="flex shrink-0 flex-col items-center gap-1 rounded-lg bg-secondary/40 px-4 py-2"
          >
            {/* Teams + scores */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-white tabular-nums">
                {game.away_tricode}
                {!isScheduled && <span className="ml-1">{game.away_score}</span>}
              </span>

              <span className="text-[10px] text-white/40">
                {isScheduled ? "vs" : "—"}
              </span>

              <span className="text-[11px] font-bold text-white tabular-nums">
                {!isScheduled && <span className="mr-1">{game.home_score}</span>}
                {game.home_tricode}
              </span>
            </div>

            {/* Status line — consistent for all states */}
            <div className="flex items-center gap-1">
              {isLive && (
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              )}
              <span className="text-[10px] font-semibold text-white/70">
                {isLive
                  ? formatClock(game.period, game.clock)
                  : isScheduled && game.commence_time
                    ? formatGameTime(game.commence_time)
                    : isScheduled
                      ? "Scheduled"
                      : "Final"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
