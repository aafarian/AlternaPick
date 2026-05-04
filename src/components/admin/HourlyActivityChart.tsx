"use client";

import { useState, useCallback } from "react";
import { scaleLinear, scaleBand } from "d3-scale";
import { CHART_COLORS, useResponsiveWidth } from "@/lib/analytics/chart-utils";
import type { HourlyActivity } from "@/lib/admin/types";

interface HourlyActivityChartProps {
  data: HourlyActivity[];
}

const MARGIN = { top: 8, right: 8, bottom: 28, left: 32 };
const HEIGHT = 160;
const SERIES = [
  { key: "picks" as const, color: CHART_COLORS.blue, label: "Picks" },
  { key: "cards" as const, color: CHART_COLORS.green, label: "Cards" },
  { key: "signups" as const, color: "#a78bfa", label: "Signups" },
];

export default function HourlyActivityChart({ data }: HourlyActivityChartProps) {
  const { containerRef, width } = useResponsiveWidth();
  const [hovered, setHovered] = useState<number | null>(null);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const maxVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.cards, d.picks, d.signups)),
  );

  const xScale = scaleBand<number>()
    .domain(data.map((d) => d.hour))
    .range([0, innerW])
    .padding(0.2);

  const yScale = scaleLinear().domain([0, maxVal]).range([innerH, 0]).nice();

  const barWidth = Math.max(1, xScale.bandwidth() / SERIES.length);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (data.length === 0 || width === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - MARGIN.left;
      const step = innerW / data.length;
      const idx = Math.floor(x / step);
      setHovered(Math.max(0, Math.min(data.length - 1, idx)));
    },
    [data.length, width, innerW],
  );

  const totalActivity = data.reduce(
    (s, d) => s + d.cards + d.picks + d.signups,
    0,
  );

  if (totalActivity === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        No activity today yet
      </p>
    );
  }

  const yTicks = yScale.ticks(4);

  return (
    <div>
      {/* Legend */}
      <div className="mb-2 flex gap-4">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      <div ref={containerRef} className="w-full">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            className="select-none"
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {/* Grid */}
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={0}
                    x2={innerW}
                    y1={yScale(tick)}
                    y2={yScale(tick)}
                    stroke={CHART_COLORS.muted}
                    strokeOpacity={0.15}
                  />
                  <text
                    x={-4}
                    y={yScale(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill={CHART_COLORS.muted}
                    fontSize={9}
                  >
                    {tick}
                  </text>
                </g>
              ))}

              {/* Hover highlight */}
              {hovered != null && (
                <rect
                  x={xScale(data[hovered].hour) ?? 0}
                  y={0}
                  width={xScale.bandwidth()}
                  height={innerH}
                  fill={CHART_COLORS.muted}
                  fillOpacity={0.08}
                  rx={2}
                />
              )}

              {/* Grouped bars */}
              {data.map((d) => {
                const groupX = xScale(d.hour) ?? 0;
                return SERIES.map((s, si) => {
                  const val = d[s.key];
                  if (val === 0) return null;
                  const barH = innerH - yScale(val);
                  return (
                    <rect
                      key={`${d.hour}-${s.key}`}
                      x={groupX + si * barWidth}
                      y={yScale(val)}
                      width={barWidth - 1}
                      height={Math.max(0, barH)}
                      fill={s.color}
                      fillOpacity={0.8}
                      rx={1}
                    />
                  );
                });
              })}

              {/* X-axis labels (every 3 hours) */}
              {data.map((d) => {
                if (d.hour % 3 !== 0) return null;
                const x = (xScale(d.hour) ?? 0) + xScale.bandwidth() / 2;
                const label =
                  d.hour === 0
                    ? "12a"
                    : d.hour === 12
                      ? "12p"
                      : d.hour < 12
                        ? `${d.hour}a`
                        : `${d.hour - 12}p`;
                return (
                  <text
                    key={d.hour}
                    x={x}
                    y={innerH + 16}
                    textAnchor="middle"
                    fill={CHART_COLORS.muted}
                    fontSize={9}
                  >
                    {label}
                  </text>
                );
              })}

              {/* Tooltip */}
              {hovered != null && data[hovered] && (
                <g>
                  <rect
                    x={Math.min(
                      (xScale(data[hovered].hour) ?? 0) - 10,
                      innerW - 120,
                    )}
                    y={-2}
                    width={120}
                    height={44}
                    fill={CHART_COLORS.surface}
                    stroke={CHART_COLORS.muted}
                    strokeOpacity={0.3}
                    rx={4}
                  />
                  {SERIES.map((s, si) => (
                    <text
                      key={s.key}
                      x={
                        Math.min(
                          (xScale(data[hovered].hour) ?? 0) - 4,
                          innerW - 114,
                        )
                      }
                      y={12 + si * 12}
                      fill={s.color}
                      fontSize={10}
                    >
                      {s.label}: {data[hovered][s.key]}
                    </text>
                  ))}
                </g>
              )}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
