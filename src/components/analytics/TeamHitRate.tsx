"use client";

import { scaleBand, scaleLinear } from "d3-scale";
import type { TeamStats } from "@/lib/analytics/types";
import { teamTricode } from "@/lib/constants";
import {
  CHART_COLORS,
  rateColor,
  useResponsiveWidth,
} from "@/lib/analytics/chart-utils";

interface TeamHitRateProps {
  data: TeamStats[];
}

const MARGIN = { top: 4, right: 90, bottom: 4, left: 56 };
const ROW_HEIGHT = 26;
const GRID_TICKS = [0, 25, 50, 75, 100];

export default function TeamHitRate({ data }: TeamHitRateProps) {
  const { containerRef, width } = useResponsiveWidth();

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Hit Rate by Team
        </h2>
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  const height = MARGIN.top + MARGIN.bottom + data.length * ROW_HEIGHT;
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const labels = data.map((t, i) => `${i + 1}. ${teamTricode(t.team)}`);

  const yScale = scaleBand<string>()
    .domain(labels)
    .range([0, innerH])
    .padding(0.2);

  const xScale = scaleLinear().domain([0, 100]).range([0, innerW]);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Hit Rate by Team
      </h2>
      <div ref={containerRef} className="w-full">
        {width > 0 && (
          <svg width={width} height={height}>
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {/* Grid lines */}
              {GRID_TICKS.map((tick) => (
                <line
                  key={tick}
                  x1={xScale(tick)}
                  x2={xScale(tick)}
                  y1={0}
                  y2={innerH}
                  stroke={CHART_COLORS.muted}
                  strokeOpacity={0.12}
                  strokeDasharray="4 4"
                />
              ))}

              {/* Bars + labels */}
              {data.map((team, i) => {
                const pct = Math.round(team.rate * 100);
                const label = labels[i];
                const y = yScale(label) ?? 0;
                const bh = yScale.bandwidth();

                return (
                  <g key={team.team}>
                    {/* Y-axis label: rank + tricode */}
                    <text
                      x={-8}
                      y={y + bh / 2}
                      dy="0.35em"
                      textAnchor="end"
                      fill="#e5e5e5"
                      fontSize={11}
                      fontWeight="bold"
                    >
                      {label}
                    </text>

                    {/* Bar */}
                    <rect
                      x={0}
                      y={y}
                      width={Math.max(xScale(pct), 0)}
                      height={bh}
                      rx={3}
                      fill={rateColor(pct)}
                      fillOpacity={0.75}
                    />

                    {/* Stats on right side */}
                    <text
                      x={Math.max(xScale(pct), 0) + 6}
                      y={y + bh / 2}
                      dy="0.35em"
                      fill={CHART_COLORS.muted}
                      fontSize={9}
                      fontFamily="monospace"
                    >
                      {pct}% ({team.hits}/{team.total})
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
