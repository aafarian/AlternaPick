"use client";

import type { PlayerStats } from "@/lib/analytics/types";
import {
  rateColor,
  CHART_SECTION_CLASS,
  CHART_TITLE_CLASS,
} from "@/lib/analytics/chart-utils";
import { SPORT_LABELS, isValidSport } from "@/lib/sports";

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

function Initials({ name }: { name: string }) {
  const parts = name.split(" ");
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : name.slice(0, 2);
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-bold text-muted-foreground">
      {initials.toUpperCase()}
    </div>
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
      <div className="mb-3 grid grid-cols-3 gap-2">
        {top3.map((player, i) => {
          const pct = Math.round(player.rate * 100);
          const color = rateColor(pct);

          return (
            <div
              key={player.player_name}
              className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.03] px-2 py-2.5"
            >
              <span className="text-[10px] font-bold text-amber-400">#{i + 1}</span>
              <Initials name={player.player_name} />
              <span className="mt-0.5 max-w-full truncate text-center text-[11px] font-semibold leading-tight">
                {player.player_name.split(" ").slice(-1)[0]}
              </span>
              <span className="text-sm font-black tabular-nums" style={{ color }}>
                {pct}%
              </span>
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

      {/* Rest — compact rows */}
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
                <span className="w-4 shrink-0 text-right text-[10px] text-muted-foreground/40">
                  {i + 4}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs">{player.player_name}</span>
                <SportBadge sport={player.sport} />
                <span className="text-xs font-bold tabular-nums" style={{ color }}>{pct}%</span>
                <span className="text-[10px] tabular-nums text-muted-foreground">{player.hits}/{player.total}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
