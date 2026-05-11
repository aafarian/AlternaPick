"use client";

import type { PlayerStats } from "@/lib/analytics/types";
import {
  rateColor,
  CHART_SECTION_CLASS,
  CHART_TITLE_CLASS,
} from "@/lib/analytics/chart-utils";
import { SPORT_LABELS, isValidSport } from "@/lib/sports";
import PlayerHeadshot from "@/components/props/PlayerHeadshot";

interface PlayerHitRateProps {
  data: PlayerStats[];
}

function SportBadge({ sport }: { sport?: string }) {
  if (!sport || !isValidSport(sport)) return null;
  return (
    <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
      {SPORT_LABELS[sport]}
    </span>
  );
}

export default function PlayerHitRate({ data }: PlayerHitRateProps) {
  if (data.length === 0) return null;

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  return (
    <div className={CHART_SECTION_CLASS}>
      <h2 className={CHART_TITLE_CLASS}>Top Players</h2>

      {/* Podium — top 3 */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {top3.map((player, i) => {
          const pct = Math.round(player.rate * 100);
          const color = rateColor(pct);

          return (
            <div
              key={player.player_name}
              className="flex flex-col items-center gap-1.5 rounded-xl bg-white/[0.03] p-3"
            >
              {/* Rank badge */}
              <span className="text-[10px] font-bold text-muted-foreground">
                #{i + 1}
              </span>

              {/* Headshot */}
              <div className="relative">
                <PlayerHeadshot
                  playerId={null}
                  playerName={player.player_name}
                  sport={player.sport}
                  responsive={false}
                />
                {/* Hit rate ring */}
                <div
                  className="absolute -bottom-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[9px] font-black text-white"
                  style={{ backgroundColor: color }}
                >
                  {pct}%
                </div>
              </div>

              {/* Name */}
              <span className="max-w-full truncate text-center text-[11px] font-semibold leading-tight">
                {player.player_name.split(" ").pop()}
              </span>

              {/* Sport + count */}
              <div className="flex items-center gap-1">
                <SportBadge sport={player.sport} />
                <span className="text-[9px] tabular-nums text-muted-foreground">
                  {player.hits}/{player.total}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rest — compact table */}
      {rest.length > 0 && (
        <div className="flex flex-col">
          {rest.map((player, i) => {
            const pct = Math.round(player.rate * 100);
            const color = rateColor(pct);

            return (
              <div
                key={player.player_name}
                className="flex items-center gap-2 border-t border-white/5 py-1.5"
              >
                <span className="w-5 shrink-0 text-right text-[10px] font-bold text-muted-foreground/50">
                  {i + 4}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs">
                  {player.player_name}
                </span>
                <SportBadge sport={player.sport} />
                <span
                  className="text-xs font-bold tabular-nums"
                  style={{ color }}
                >
                  {pct}%
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {player.hits}/{player.total}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
