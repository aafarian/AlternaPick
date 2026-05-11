"use client";

import type { CardSizeStats } from "@/lib/analytics/types";
import {
  rateColor,
  CHART_SECTION_CLASS,
  CHART_TITLE_CLASS,
} from "@/lib/analytics/chart-utils";
import { cn } from "@/lib/utils";

interface CardSizeChartProps {
  data: CardSizeStats[];
}

export default function CardSizeChart({ data }: CardSizeChartProps) {
  if (data.length === 0) {
    return (
      <div className={CHART_SECTION_CLASS}>
        <h2 className={CHART_TITLE_CLASS}>Hit Rate by Card Size</h2>
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  return (
    <div className={CHART_SECTION_CLASS}>
      <h2 className={CHART_TITLE_CLASS}>Hit Rate by Card Size</h2>
      <div className="flex flex-col gap-1.5">
        {data.map((item, i) => {
          const pct = Math.round(item.rate * 100);
          const color = rateColor(pct);

          return (
            <div key={item.cardSize} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-right text-[11px] font-medium text-muted-foreground">
                {item.cardSize}-Pick
              </span>
              <div className="relative h-[18px] flex-1 overflow-hidden rounded bg-white/[0.04]">
                <div
                  className="absolute inset-y-0 left-0 rounded transition-all duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
                    opacity: 0.7,
                    transitionDelay: `${i * 40}ms`,
                  }}
                />
                <span className={cn(
                  "relative z-[1] flex h-full items-center px-1.5 text-[9px] font-bold tabular-nums",
                  pct > 12 ? "text-white" : "text-muted-foreground",
                )}>
                  {pct}%
                </span>
              </div>
              <span className="hidden shrink-0 text-[9px] tabular-nums text-muted-foreground sm:inline">
                {item.hits}/{item.total} · {item.cards}c
              </span>
              <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground sm:hidden">
                {item.hits}/{item.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
