"use client";

import { scaleBand, scaleLinear } from "d3-scale";
import type { CardSizeStats } from "@/lib/analytics/types";
import {
  CHART_COLORS,
  BAR_GRADIENT_ID,
  BarGradientDef,
  useResponsiveWidth,
  CHART_SECTION_CLASS,
  CHART_TITLE_CLASS,
} from "@/lib/analytics/chart-utils";

interface CardSizeChartProps {
  data: CardSizeStats[];
}

const MARGIN = { top: 4, right: 90, bottom: 4, left: 64 };
const ROW_HEIGHT = 28;
const GRID_TICKS = [0, 25, 50, 75, 100];

export default function CardSizeChart({ data }: CardSizeChartProps) {
  const { containerRef, width } = useResponsiveWidth();

  if (data.length === 0) {
    return (
      <div className={CHART_SECTION_CLASS}>
        <h2 className={CHART_TITLE_CLASS}>
          Hit Rate by Card Size
        </h2>
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  const height = MARGIN.top + MARGIN.bottom + data.length * ROW_HEIGHT;
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const labels = data.map((item) => `${item.cardSize}-Pick`);

  const yScale = scaleBand<string>()
    .domain(labels)
    .range([0, innerH])
    .padding(0.25);

  const xScale = scaleLinear().domain([0, 100]).range([0, innerW]);

  return (
    <div className={CHART_SECTION_CLASS}>
      <h2 className={CHART_TITLE_CLASS}>
        Hit Rate by Card Size
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
                  <g key={item.cardSize}>
                    {/* Y-axis label */}
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
                      fontSize={9}
                      fontFamily="monospace"
                    >
                      {pct}% ({item.hits}/{item.total} · {item.cards} card
                      {item.cards !== 1 ? "s" : ""})
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
