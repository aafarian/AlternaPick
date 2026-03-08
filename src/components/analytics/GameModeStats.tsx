"use client";

import { scaleBand, scaleLinear } from "d3-scale";
import type { GameModeStats as GameModeStatsType } from "@/lib/analytics/types";
import { GAME_MODES } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/supabase/types";
import {
  CHART_COLORS,
  BAR_GRADIENT_ID,
  BarGradientDef,
  useResponsiveWidth,
} from "@/lib/analytics/chart-utils";

interface GameModeStatsProps {
  data: GameModeStatsType[];
}

const MARGIN = { top: 4, right: 90, bottom: 4, left: 100 };
const ROW_HEIGHT = 28;
const GRID_TICKS = [0, 25, 50, 75, 100];

export default function GameModeStats({ data }: GameModeStatsProps) {
  const { containerRef, width } = useResponsiveWidth();

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Card Win Rate by Mode
        </h2>
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  const labels = data.map((item) => {
    const modeDef = GAME_MODES[item.mode as GameMode];
    const icon = modeDef?.icon ?? "";
    const name = modeDef?.displayName ?? item.mode;
    return `${icon} ${name}`;
  });

  const height = MARGIN.top + MARGIN.bottom + data.length * ROW_HEIGHT;
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const yScale = scaleBand<string>()
    .domain(labels)
    .range([0, innerH])
    .padding(0.25);

  const xScale = scaleLinear().domain([0, 100]).range([0, innerW]);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Win Rate by Game Mode
      </h2>
      <div ref={containerRef} className="w-full">
        {width > 0 && (
          <svg width={width} height={height}>
            <BarGradientDef />
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
              {data.map((item, i) => {
                const winPct = Math.round(item.winRate * 100);
                const label = labels[i];
                const y = yScale(label) ?? 0;
                const bh = yScale.bandwidth();

                return (
                  <g key={item.mode}>
                    {/* Y-axis label: icon + name */}
                    <text
                      x={-8}
                      y={y + bh / 2}
                      dy="0.35em"
                      textAnchor="end"
                      fill={CHART_COLORS.text}
                      fontSize={11}
                    >
                      {label}
                    </text>

                    {/* Bar */}
                    <rect
                      x={0}
                      y={y}
                      width={Math.max(xScale(winPct), 0)}
                      height={bh}
                      rx={3}
                      fill={`url(#${BAR_GRADIENT_ID})`}
                      fillOpacity={0.85}
                    />

                    {/* Stats on right side */}
                    <text
                      x={Math.max(xScale(winPct), 0) + 6}
                      y={y + bh / 2}
                      dy="0.35em"
                      fill={CHART_COLORS.muted}
                      fontSize={9}
                      fontFamily="monospace"
                    >
                      {winPct}% ({item.wins}/{item.cards} · avg {item.avgScore})
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      {/* Info */}
      <p className="mt-3 text-[10px] text-muted-foreground">
        Win = 66%+ picks correct on a card
      </p>
    </div>
  );
}
