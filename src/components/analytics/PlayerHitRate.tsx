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

  return (
    <div className={CHART_SECTION_CLASS}>
      <h2 className={CHART_TITLE_CLASS}>Top Players</h2>

      <div className="flex flex-col">
        {data.map((player, i) => {
          const pct = Math.round(player.rate * 100);
          const color = rateColor(pct);
          const isTop3 = i < 3;

          return (
            <div
              key={player.player_name}
              className="flex items-center gap-2.5 border-t border-white/5 py-2 first:border-0 first:pt-0"
            >
              {/* Rank */}
              <span className={`w-4 shrink-0 text-right text-[11px] font-bold ${isTop3 ? "text-amber-400" : "text-muted-foreground/40"}`}>
                {i + 1}
              </span>

              {/* Avatar */}
              <Initials name={player.player_name} />

              {/* Name + sport */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{player.player_name}</p>
                <div className="mt-0.5 flex items-center gap-1">
                  <SportBadge sport={player.sport} />
                  <span className="text-[9px] tabular-nums text-muted-foreground">
                    {player.hits}/{player.total} picks
                  </span>
                </div>
              </div>

              {/* Hit rate */}
              <span className="text-sm font-black tabular-nums" style={{ color }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
