"use client";

import { useState } from "react";
import { scaleBand, scaleLinear } from "d3-scale";
import type { ScoreDistributionEntry } from "@/lib/analytics/types";
import {
  CHART_COLORS,
  rateColor,
  useResponsiveWidth,
  CHART_SECTION_CLASS,
  CHART_TITLE_CLASS,
} from "@/lib/analytics/chart-utils";
import { cn } from "@/lib/utils";

interface ScoreDistributionProps {
  data: ScoreDistributionEntry[];
}

const MARGIN = { top: 18, right: 8, bottom: 20, left: 8 };
const BAR_HEIGHT = 140;

export default function ScoreDistribution({ data }: ScoreDistributionProps) {
  const { containerRef, width } = useResponsiveWidth();

  // Group entries by card size
  const sizeGroups = new Map<number, ScoreDistributionEntry[]>();
  for (const entry of data) {
    const group = sizeGroups.get(entry.cardSize) ?? [];
    group.push(entry);
    sizeGroups.set(entry.cardSize, group);
  }
  const sortedSizes = [...sizeGroups.keys()].sort((a, b) => a - b);

  const [activeSize, setActiveSize] = useState(sortedSizes[0] ?? 2);

  if (data.length === 0) {
    return (
      <div className={CHART_SECTION_CLASS}>
        <h2 className={CHART_TITLE_CLASS}>Score Distribution</h2>
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  const entries = sizeGroups.get(activeSize) ?? [];
  const totalCards = entries.reduce((s, e) => s + e.count, 0);

  const scoreMap = new Map<number, number>();
  for (const e of entries) scoreMap.set(e.score, e.count);

  const scores: { label: string; count: number; ratio: number }[] = [];
  for (let s = 0; s <= activeSize; s++) {
    const count = scoreMap.get(s) ?? 0;
    scores.push({
      label: `${s}/${activeSize}`,
      count,
      ratio: activeSize > 0 ? s / activeSize : 0,
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
    <div className={CHART_SECTION_CLASS}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={cn(CHART_TITLE_CLASS, "mb-0")}>Score Distribution</h2>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {totalCards} card{totalCards !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Size tabs */}
      <div className="mb-3 flex flex-wrap gap-1">
        {sortedSizes.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => setActiveSize(size)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors",
              activeSize === size
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {size}-Pick
          </button>
        ))}
      </div>

      {/* Chart */}
      <div ref={containerRef} className="w-full overflow-hidden">
        {width > 0 && (
          <svg width={width} height={BAR_HEIGHT}>
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
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
                      rx={3}
                      fill={count > 0 ? rateColor(pct) : CHART_COLORS.muted}
                      fillOpacity={count > 0 ? 0.8 : 0.15}
                    />
                    {count > 0 && (
                      <text
                        x={x + bw / 2}
                        y={y - 4}
                        textAnchor="middle"
                        fill={CHART_COLORS.text}
                        fontSize={10}
                        fontWeight="bold"
                      >
                        {count}
                      </text>
                    )}
                    <text
                      x={x + bw / 2}
                      y={innerH + 14}
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
        )}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded" style={{ backgroundColor: CHART_COLORS.green }} />
          60%+
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded" style={{ backgroundColor: CHART_COLORS.blue }} />
          40-59%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded" style={{ backgroundColor: CHART_COLORS.red }} />
          &lt;40%
        </span>
      </div>
    </div>
  );
}
