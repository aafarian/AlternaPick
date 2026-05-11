"use client";

import type { TeamStats } from "@/lib/analytics/types";
import { teamTricode } from "@/lib/constants";
import {
  rateColor,
  CHART_SECTION_CLASS,
  CHART_TITLE_CLASS,
} from "@/lib/analytics/chart-utils";
import { cn } from "@/lib/utils";

interface TeamHitRateProps {
  data: TeamStats[];
}

export default function TeamHitRate({ data }: TeamHitRateProps) {
  if (data.length === 0) {
    return (
      <div className={CHART_SECTION_CLASS}>
        <h2 className={CHART_TITLE_CLASS}>Hit Rate by Team</h2>
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  return (
    <div className={CHART_SECTION_CLASS}>
      <h2 className={CHART_TITLE_CLASS}>Hit Rate by Team</h2>
      <div className="flex flex-col gap-1">
        {data.map((team, i) => {
          const pct = Math.round(team.rate * 100);
          const color = rateColor(pct);
          const tricode = teamTricode(team.team);

          return (
            <div key={team.team} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-right text-[11px] font-bold text-muted-foreground">
                {i + 1}. {tricode}
              </span>
              <div className="relative h-[18px] flex-1 overflow-hidden rounded bg-white/[0.04]">
                <div
                  className="absolute inset-y-0 left-0 rounded transition-all duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
                    opacity: 0.7,
                    transitionDelay: `${i * 30}ms`,
                  }}
                />
                <span className={cn(
                  "relative z-[1] flex h-full items-center px-1.5 text-[9px] font-bold tabular-nums",
                  pct > 12 ? "text-white" : "text-muted-foreground",
                )}>
                  {pct}%
                </span>
              </div>
              <span className="hidden w-10 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground sm:block">
                {team.hits}/{team.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
