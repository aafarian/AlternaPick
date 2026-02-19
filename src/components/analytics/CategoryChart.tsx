"use client";

import { scaleBand, scaleLinear } from "d3-scale";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { CategoryStats } from "@/lib/analytics/types";
import type { StatCategory } from "@/lib/supabase/types";
import {
  CHART_COLORS,
  BAR_GRADIENT_ID,
  BarGradientDef,
  useResponsiveWidth,
} from "@/lib/analytics/chart-utils";

interface CategoryChartProps {
  data: CategoryStats[];
}

const MARGIN = { top: 4, right: 90, bottom: 4, left: 80 };
const ROW_HEIGHT = 28;
const GRID_TICKS = [0, 25, 50, 75, 100];

export default function CategoryChart({ data }: CategoryChartProps) {
  const { containerRef, width } = useResponsiveWidth();

  if (data.length === 0) return null;

  const height = MARGIN.top + MARGIN.bottom + data.length * ROW_HEIGHT;
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const labels = data.map(
    (item) => CATEGORY_LABELS[item.category as StatCategory] ?? item.category,
  );

  const yScale = scaleBand<string>()
    .domain(labels)
    .range([0, innerH])
    .padding(0.25);

  const xScale = scaleLinear().domain([0, 100]).range([0, innerW]);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Hit Rate by Category
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
                const pct = Math.round(item.rate * 100);
                const label = labels[i];
                const y = yScale(label) ?? 0;
                const bh = yScale.bandwidth();

                return (
                  <g key={item.category}>
                    {/* Y-axis label */}
                    <text
                      x={-8}
                      y={y + bh / 2}
                      dy="0.35em"
                      textAnchor="end"
                      fill="#e5e5e5"
                      fontSize={11}
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
                      fill={`url(#${BAR_GRADIENT_ID})`}
                      fillOpacity={0.85}
                    />

                    {/* Stats on right side */}
                    <text
                      x={Math.max(xScale(pct), 0) + 6}
                      y={y + bh / 2}
                      dy="0.35em"
                      fill={CHART_COLORS.muted}
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      {pct}% ({item.hits}/{item.total})
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
