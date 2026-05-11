"use client";

import type { GameModeStats as GameModeStatsType } from "@/lib/analytics/types";
import { GAME_MODES } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/supabase/types";
import {
  rateColor,
  CHART_SECTION_CLASS,
  CHART_TITLE_CLASS,
} from "@/lib/analytics/chart-utils";
import { cn } from "@/lib/utils";

interface GameModeStatsProps {
  data: GameModeStatsType[];
}

export default function GameModeStats({ data }: GameModeStatsProps) {
  if (data.length === 0) {
    return (
      <div className={CHART_SECTION_CLASS}>
        <h2 className={CHART_TITLE_CLASS}>Win Rate by Game Mode</h2>
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  return (
    <div className={CHART_SECTION_CLASS}>
      <h2 className={CHART_TITLE_CLASS}>Win Rate by Game Mode</h2>
      <div className="flex flex-col gap-1.5">
        {data.map((item, i) => {
          const winPct = Math.round(item.winRate * 100);
          const color = rateColor(winPct);
          const modeDef = GAME_MODES[item.mode as GameMode];
          const icon = modeDef?.icon ?? "";
          const name = modeDef?.displayName ?? item.mode;

          return (
            <div key={item.mode} className="flex items-center gap-2">
              <span className="w-20 shrink-0 truncate text-right text-[11px] font-medium text-muted-foreground">
                {icon} {name}
              </span>
              <div className="relative h-[18px] flex-1 overflow-hidden rounded bg-white/[0.04]">
                <div
                  className="absolute inset-y-0 left-0 rounded transition-all duration-700 ease-out"
                  style={{
                    width: `${winPct}%`,
                    backgroundColor: color,
                    opacity: 0.7,
                    transitionDelay: `${i * 40}ms`,
                  }}
                />
                <span className={cn(
                  "relative z-[1] flex h-full items-center px-1.5 text-[9px] font-bold tabular-nums",
                  winPct > 12 ? "text-white" : "text-muted-foreground",
                )}>
                  {winPct}%
                </span>
              </div>
              <span className="hidden shrink-0 text-[9px] tabular-nums text-muted-foreground sm:inline">
                {item.wins}/{item.cards}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-[9px] text-muted-foreground">
        Win = 66%+ picks correct on a card
      </p>
    </div>
  );
}
