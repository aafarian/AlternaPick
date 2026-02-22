"use client";

import type { LiveGameStatus } from "@/lib/cards/live-types";
import { teamTricode } from "@/lib/constants";
import { formatClock, formatGameTime } from "@/lib/format";

function TeamBadge({ team, tricode, logo, score, showScore, side }: {
  team: string;
  tricode: string;
  logo?: string;
  score: number;
  showScore: boolean;
  side: "away" | "home";
}) {
  const code = tricode || teamTricode(team);

  return (
    <div className={`flex items-center gap-1.5 ${side === "home" ? "flex-row-reverse" : ""}`}>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={code} width={18} height={18} className="shrink-0 object-contain" />
      )}
      <span className="text-[11px] font-bold text-white tabular-nums">
        {side === "away" ? (
          <>
            {code}
            {showScore && <span className="ml-1">{score}</span>}
          </>
        ) : (
          <>
            {showScore && <span className="mr-1">{score}</span>}
            {code}
          </>
        )}
      </span>
    </div>
  );
}

export default function GameScoreBanner({ games }: { games: LiveGameStatus[] }) {
  if (games.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {games.map((game, idx) => {
        const isScheduled = game.status === "scheduled";
        const isLive = game.status === "live";
        const key = `${game.external_event_id}-${idx}`;

        const inner = (
          <div
            className={`flex shrink-0 flex-col items-center gap-1 rounded-lg bg-secondary/40 px-4 py-2 transition-colors ${game.game_url ? "cursor-pointer hover:bg-secondary/60" : ""}`}
          >
            {/* Teams + scores */}
            <div className="flex items-center gap-2">
              <TeamBadge
                team={game.away_team}
                tricode={game.away_tricode}
                logo={game.away_logo}
                score={game.away_score}
                showScore={!isScheduled}
                side="away"
              />

              <span className="text-[10px] text-white/40">
                {isScheduled ? "vs" : "—"}
              </span>

              <TeamBadge
                team={game.home_team}
                tricode={game.home_tricode}
                logo={game.home_logo}
                score={game.home_score}
                showScore={!isScheduled}
                side="home"
              />
            </div>

            {/* Status line */}
            <div className="flex items-center gap-1">
              {isLive && (
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              )}
              <span className="text-[10px] font-semibold text-white/70">
                {isLive
                  ? formatClock(game.period, game.clock, game.sport)
                  : isScheduled && game.commence_time
                    ? formatGameTime(game.commence_time)
                    : isScheduled
                      ? "Scheduled"
                      : "Final"}
              </span>
            </div>
          </div>
        );

        return game.game_url ? (
          <button
            key={key}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(game.game_url, "_blank", "noopener,noreferrer");
            }}
          >
            {inner}
          </button>
        ) : (
          <div key={key}>{inner}</div>
        );
      })}
    </div>
  );
}
