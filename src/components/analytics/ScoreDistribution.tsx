"use client";

import { scaleBand, scaleLinear } from "d3-scale";
import type { ScoreDistributionEntry } from "@/lib/analytics/types";
import {
  CHART_COLORS,
  rateColor,
  useResponsiveWidth,
} from "@/lib/analytics/chart-utils";

interface ScoreDistributionProps {
  data: ScoreDistributionEntry[];
}

const MARGIN = { top: 18, right: 8, bottom: 20, left: 8 };
const BAR_HEIGHT = 120;

export default function ScoreDistribution({ data }: ScoreDistributionProps) {
  const { containerRef, width } = useResponsiveWidth();

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Score Distribution
        </h2>
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  // Group entries by card size
  const sizeGroups = new Map<number, ScoreDistributionEntry[]>();
  for (const entry of data) {
    const group = sizeGroups.get(entry.cardSize) ?? [];
    group.push(entry);
    sizeGroups.set(entry.cardSize, group);
  }

  const sortedSizes = [...sizeGroups.keys()].sort((a, b) => a - b);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Score Distribution
      </h2>
      <div ref={containerRef} className="flex w-full flex-col gap-5">
        {width > 0 &&
          sortedSizes.map((cardSize) => {
            const entries = sizeGroups.get(cardSize)!;
            const totalCards = entries.reduce((s, e) => s + e.count, 0);

            // Build full score range 0..cardSize
            const scoreMap = new Map<number, number>();
            for (const e of entries) scoreMap.set(e.score, e.count);

            const scores: { label: string; count: number; ratio: number }[] = [];
            for (let s = 0; s <= cardSize; s++) {
              const count = scoreMap.get(s) ?? 0;
              scores.push({
                label: `${s}/${cardSize}`,
                count,
                ratio: cardSize > 0 ? s / cardSize : 0,
              });
            }

            const innerW = width - MARGIN.left - MARGIN.right;
            const innerH = BAR_HEIGHT - MARGIN.top - MARGIN.bottom;

            const maxCount = Math.max(...scores.map((s) => s.count), 1);

            const xScale = scaleBand<string>()
              .domain(scores.map((s) => s.label))
              .range([0, innerW])
              .padding(0.25);

            const yScale = scaleLinear()
              .domain([0, maxCount])
              .range([innerH, 0]);

            return (
              <div key={cardSize}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    {cardSize}-Pick Cards
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {totalCards} card{totalCards !== 1 ? "s" : ""}
                  </span>
                </div>
                <svg width={width} height={BAR_HEIGHT}>
                  <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                    {/* Bars */}
                    {scores.map(({ label, count, ratio }) => {
                      const x = xScale(label) ?? 0;
                      const bw = xScale.bandwidth();
                      const barH = count > 0 ? innerH - yScale(count) : 0;
                      const y = innerH - barH;
                      const pct = Math.round(ratio * 100);

                      return (
                        <g key={label}>
                          <rect
                            x={x}
                            y={y}
                            width={bw}
                            height={barH}
                            rx={2}
                            fill={count > 0 ? rateColor(pct) : CHART_COLORS.muted}
                            fillOpacity={count > 0 ? 0.8 : 0.15}
                          />
                          {/* Count label above bar */}
                          {count > 0 && (
                            <text
                              x={x + bw / 2}
                              y={y - 3}
                              textAnchor="middle"
                              fill={CHART_COLORS.text}
                              fontSize={9}
                              fontWeight="bold"
                            >
                              {count}
                            </text>
                          )}
                          {/* X-axis label */}
                          <text
                            x={x + bw / 2}
                            y={innerH + 13}
                            textAnchor="middle"
                            fill={CHART_COLORS.muted}
                            fontSize={9}
                          >
                            {label}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            );
          })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded"
            style={{ backgroundColor: CHART_COLORS.green }}
          />
          60%+ correct
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded"
            style={{ backgroundColor: CHART_COLORS.blue }}
          />
          40-59%
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded"
            style={{ backgroundColor: CHART_COLORS.red }}
          />
          &lt;40%
        </span>
      </div>
    </div>
  );
}
