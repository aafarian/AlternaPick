"use client";

import { useId, useState, useCallback } from "react";
import { scaleLinear, scaleBand } from "d3-scale";
import { CHART_COLORS, useResponsiveWidth } from "@/lib/analytics/chart-utils";
import type { SignupTrendPoint } from "@/lib/admin/types";

interface SignupTrendChartProps {
  data: SignupTrendPoint[];
}

const MARGIN = { top: 8, right: 8, bottom: 28, left: 32 };
const HEIGHT = 180;

export default function SignupTrendChart({ data }: SignupTrendChartProps) {
  const gradientId = `signupFill-${useId()}`;
  const { containerRef, width } = useResponsiveWidth();
  const [hovered, setHovered] = useState<number | null>(null);

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const maxSignups = Math.max(1, ...data.map((d) => d.signups));

  const xScale = scaleBand<string>()
    .domain(data.map((d) => d.date))
    .range([0, innerW])
    .padding(0.25);

  const yScale = scaleLinear().domain([0, maxSignups]).range([innerH, 0]).nice();

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

  const totalSignups = data.reduce((s, d) => s + d.signups, 0);

  if (data.length === 0 || totalSignups === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        No signups in the last 30 days
      </p>
    );
  }

  // Y-axis ticks
  const yTicks = yScale.ticks(4);

  return (
    <div ref={containerRef} className="w-full">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
          className="select-none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.8} />
              <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
            </linearGradient>
          </defs>

          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Grid lines */}
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

            {/* Bars */}
            {data.map((d, i) => {
              const barW = xScale.bandwidth();
              const barH = innerH - yScale(d.signups);
              return (
                <rect
                  key={d.date}
                  x={xScale(d.date) ?? 0}
                  y={yScale(d.signups)}
                  width={barW}
                  height={Math.max(0, barH)}
                  fill={i === hovered ? CHART_COLORS.blue : `url(#${gradientId})`}
                  rx={2}
                />
              );
            })}

            {/* X-axis labels (every 7 days) */}
            {data.map((d, i) => {
              if (i % 7 !== 0 && i !== data.length - 1) return null;
              const x = (xScale(d.date) ?? 0) + xScale.bandwidth() / 2;
              return (
                <text
                  key={d.date}
                  x={x}
                  y={innerH + 16}
                  textAnchor="middle"
                  fill={CHART_COLORS.muted}
                  fontSize={9}
                >
                  {d.date.slice(5)}
                </text>
              );
            })}

            {/* Tooltip */}
            {hovered != null && data[hovered] && (
              <g>
                <rect
                  x={Math.min((xScale(data[hovered].date) ?? 0) - 30, innerW - 80)}
                  y={Math.max(yScale(data[hovered].signups) - 32, 0)}
                  width={80}
                  height={24}
                  fill={CHART_COLORS.surface}
                  stroke={CHART_COLORS.muted}
                  strokeOpacity={0.3}
                  rx={4}
                />
                <text
                  x={Math.min((xScale(data[hovered].date) ?? 0) + 10, innerW - 40)}
                  y={Math.max(yScale(data[hovered].signups) - 16, 12)}
                  fill={CHART_COLORS.text}
                  fontSize={10}
                  textAnchor="middle"
                >
                  {data[hovered].date.slice(5)}: {data[hovered].signups} signups
                </text>
              </g>
            )}
          </g>
        </svg>
      )}
    </div>
  );
}
