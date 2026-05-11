"use client";

import { useState, useCallback } from "react";
import { scaleTime, scaleLinear } from "d3-scale";
import { line, area, curveMonotoneX } from "d3-shape";
import { timeFormat } from "d3-time-format";
import type { CoinTrendPoint } from "@/lib/analytics/types";
import {
  CHART_COLORS,
  FLAME_ORANGE,
  useResponsiveWidth,
} from "@/lib/analytics/chart-utils";
import FlameTokenIcon from "@/components/icons/FlameTokenIcon";

interface CoinTrendChartProps {
  data: CoinTrendPoint[];
}

const MARGIN = { top: 12, right: 48, bottom: 24, left: 44 };
const HEIGHT = 200;
const formatShort = timeFormat("%-m/%-d");

export default function CoinTrendChart({ data }: CoinTrendChartProps) {
  const { containerRef, width } = useResponsiveWidth();
  const [hovered, setHovered] = useState<number | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (data.length < 2 || width === 0) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left - MARGIN.left;
      const innerW = width - MARGIN.left - MARGIN.right;
      const fraction = x / innerW;
      const idx = Math.round(fraction * (data.length - 1));
      setHovered(Math.max(0, Math.min(data.length - 1, idx)));
    },
    [data.length, width],
  );

  if (data.length < 2) return null;

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const parsed = data
    .filter((d) => d.date)
    .map((d) => ({
      ...d,
      dateObj: new Date(d.date + "T00:00:00"),
    }));

  if (parsed.length < 2) return null;

  const balances = parsed.map((d) => d.balance);
  const minBal = Math.min(...balances);
  const maxBal = Math.max(...balances);
  const padding = Math.max((maxBal - minBal) * 0.1, 50);

  const xScale = scaleTime()
    .domain([parsed[0].dateObj, parsed[parsed.length - 1].dateObj])
    .range([0, innerW]);

  const yScale = scaleLinear()
    .domain([Math.max(0, minBal - padding), maxBal + padding])
    .range([innerH, 0]);

  const lineGen = line<(typeof parsed)[0]>()
    .x((d) => xScale(d.dateObj))
    .y((d) => yScale(d.balance))
    .curve(curveMonotoneX);

  const areaGen = area<(typeof parsed)[0]>()
    .x((d) => xScale(d.dateObj))
    .y0(innerH)
    .y1((d) => yScale(d.balance))
    .curve(curveMonotoneX);

  const linePath = lineGen(parsed) ?? "";
  const areaPath = areaGen(parsed) ?? "";

  // Grid: 4 evenly spaced horizontal lines
  const yDomain = yScale.domain();
  const gridStep = (yDomain[1] - yDomain[0]) / 4;
  const gridTicks = Array.from({ length: 5 }, (_, i) => Math.round(yDomain[0] + i * gridStep));

  const hoveredPoint = hovered !== null ? parsed[hovered] : null;
  const currentBalance = parsed[parsed.length - 1].balance;
  const startBalance = parsed[0].balance;
  const netChange = currentBalance - startBalance;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          <FlameTokenIcon className="h-4 w-4 text-orange-400" />
          Flame Coins
        </h2>
        <div className="flex items-center gap-2 text-sm tabular-nums">
          <span className="font-black text-orange-400">{currentBalance.toLocaleString()}</span>
          <span className={netChange >= 0 ? "text-neon-green" : "text-bold-red"}>
            {netChange >= 0 ? "+" : ""}{netChange.toLocaleString()}
          </span>
        </div>
      </div>

      <div ref={containerRef} className="w-full">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            className="select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          >
            <defs>
              <linearGradient id="coinAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={FLAME_ORANGE} stopOpacity={0.15} />
                <stop offset="100%" stopColor={FLAME_ORANGE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {/* Grid lines */}
              {gridTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={0}
                    x2={innerW}
                    y1={yScale(tick)}
                    y2={yScale(tick)}
                    stroke={CHART_COLORS.muted}
                    strokeOpacity={0.12}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={-8}
                    y={yScale(tick)}
                    dy="0.35em"
                    textAnchor="end"
                    fill={CHART_COLORS.muted}
                    fontSize={9}
                  >
                    {tick.toLocaleString()}
                  </text>
                </g>
              ))}

              {/* Starting balance reference line */}
              <line
                x1={0}
                x2={innerW}
                y1={yScale(startBalance)}
                y2={yScale(startBalance)}
                stroke={CHART_COLORS.muted}
                strokeOpacity={0.3}
                strokeDasharray="6 3"
              />

              {/* Area fill */}
              <path d={areaPath} fill="url(#coinAreaGrad)" />

              {/* Line */}
              <path
                d={linePath}
                fill="none"
                stroke={FLAME_ORANGE}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Dots */}
              {parsed.map((p, i) => (
                <circle
                  key={i}
                  cx={xScale(p.dateObj)}
                  cy={yScale(p.balance)}
                  r={hovered === i ? 5 : 2.5}
                  fill={FLAME_ORANGE}
                  stroke={CHART_COLORS.surface}
                  strokeWidth={1.5}
                />
              ))}

              {/* Hover crosshair + tooltip */}
              {hoveredPoint && (() => {
                const tooltipW = 120;
                const halfW = tooltipW / 2;
                const rawX = xScale(hoveredPoint.dateObj);
                const clampedX = Math.max(halfW, Math.min(innerW - halfW, rawX));
                const net = hoveredPoint.payout - hoveredPoint.wager;
                return (
                  <>
                    <line
                      x1={rawX}
                      x2={rawX}
                      y1={0}
                      y2={innerH}
                      stroke={CHART_COLORS.muted}
                      strokeOpacity={0.3}
                      strokeDasharray="3 3"
                    />
                    <g transform={`translate(${clampedX},${yScale(hoveredPoint.balance) - 18})`}>
                      <rect
                        x={-halfW}
                        y={-16}
                        width={tooltipW}
                        height={24}
                        rx={4}
                        fill={CHART_COLORS.surface}
                        fillOpacity={0.95}
                        stroke={CHART_COLORS.muted}
                        strokeOpacity={0.2}
                      />
                      <text
                        textAnchor="middle"
                        dy="-0.1em"
                        fill={CHART_COLORS.text}
                        fontSize={10}
                        fontFamily="monospace"
                      >
                        {formatShort(hoveredPoint.dateObj)} · {hoveredPoint.balance.toLocaleString()}
                        {hoveredPoint.wager > 0 && (
                          <tspan fill={net >= 0 ? CHART_COLORS.green : CHART_COLORS.red}>
                            {" "}{net >= 0 ? "+" : ""}{net}
                          </tspan>
                        )}
                      </text>
                    </g>
                  </>
                );
              })()}

              {/* X-axis labels */}
              <text
                x={0}
                y={innerH + 16}
                textAnchor="start"
                fill={CHART_COLORS.muted}
                fontSize={10}
              >
                {formatShort(parsed[0].dateObj)}
              </text>
              <text
                x={innerW}
                y={innerH + 16}
                textAnchor="end"
                fill={CHART_COLORS.muted}
                fontSize={10}
              >
                {formatShort(parsed[parsed.length - 1].dateObj)}
              </text>
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
