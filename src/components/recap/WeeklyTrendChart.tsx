"use client";

import { useState, useCallback } from "react";
import { scaleTime, scaleLinear } from "d3-scale";
import { line, area, curveMonotoneX } from "d3-shape";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import type { WeeklyTrendPoint } from "@/lib/recaps/compute";
import {
  CHART_COLORS,
  rateColor,
  useResponsiveWidth,
} from "@/lib/analytics/chart-utils";

interface WeeklyTrendChartProps {
  data: WeeklyTrendPoint[];
}

const MARGIN = { top: 8, right: 12, bottom: 22, left: 32 };
const HEIGHT = 120;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return DAY_LABELS[d.getUTCDay()];
}

/** Single stat fallback when fewer than 2 data points */
function SingleStat({ point }: { point: WeeklyTrendPoint }) {
  const pct = Math.round(point.hitRate * 100);
  const color = rateColor(pct);

  return (
    <div className="flex flex-col items-center justify-center py-4 gap-1">
      <span className="text-3xl font-bold tabular-nums" style={{ color }}>
        {pct}%
      </span>
      <span className="text-xs text-muted-foreground">
        {dayLabel(point.date)} &mdash; {point.totalPicks} pick
        {point.totalPicks !== 1 ? "s" : ""} across {point.totalCards} card
        {point.totalCards !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

export function WeeklyTrendChart({ data }: WeeklyTrendChartProps) {
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

  const handleTouch = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (data.length < 2 || width === 0) return;
      const touch = e.touches[0];
      if (!touch) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = touch.clientX - rect.left - MARGIN.left;
      const innerW = width - MARGIN.left - MARGIN.right;
      const fraction = x / innerW;
      const idx = Math.round(fraction * (data.length - 1));
      setHovered(Math.max(0, Math.min(data.length - 1, idx)));
    },
    [data.length, width],
  );

  if (data.length === 0) return null;

  // Parse data
  const parsed = data.map((d) => ({
    ...d,
    dateObj: new Date(d.date + "T00:00:00Z"),
    pct: Math.round(d.hitRate * 100),
  }));

  // Fewer than 2 points: show single stat
  if (parsed.length < 2) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight">Weekly Trend</h2>
              <p className="text-xs text-muted-foreground">
                Daily platform hit rate
              </p>
            </div>
          </div>
          <SingleStat point={parsed[0]} />
        </CardContent>
      </Card>
    );
  }

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  // Weekly average (dashed reference line)
  const avgPct = Math.round(
    parsed.reduce((sum, p) => sum + p.pct, 0) / parsed.length,
  );

  // Scales
  const xScale = scaleTime()
    .domain([parsed[0].dateObj, parsed[parsed.length - 1].dateObj])
    .range([0, innerW]);

  const yScale = scaleLinear().domain([0, 100]).range([innerH, 0]);

  // Generators
  const lineGen = line<(typeof parsed)[0]>()
    .x((d) => xScale(d.dateObj))
    .y((d) => yScale(d.pct))
    .curve(curveMonotoneX);

  const areaGen = area<(typeof parsed)[0]>()
    .x((d) => xScale(d.dateObj))
    .y0(innerH)
    .y1((d) => yScale(d.pct))
    .curve(curveMonotoneX);

  const linePath = lineGen(parsed) ?? "";
  const areaPath = areaGen(parsed) ?? "";

  const hoveredPoint = hovered !== null ? parsed[hovered] : null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">Weekly Trend</h2>
            <p className="text-xs text-muted-foreground">
              Daily platform hit rate
            </p>
          </div>
        </div>

        <div ref={containerRef} className="w-full">
          {width > 0 && (
            <svg
              width={width}
              height={HEIGHT}
              className="select-none touch-none"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHovered(null)}
              onTouchMove={handleTouch}
              onTouchEnd={() => setHovered(null)}
            >
              <defs>
                <linearGradient
                  id="weeklyTrendFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={CHART_COLORS.green}
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_COLORS.green}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>

              <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                {/* Y-axis labels: 0% and 100% */}
                <text
                  x={-6}
                  y={yScale(100)}
                  dy="0.35em"
                  textAnchor="end"
                  fill={CHART_COLORS.muted}
                  fontSize={9}
                >
                  100%
                </text>
                <text
                  x={-6}
                  y={yScale(0)}
                  dy="0.35em"
                  textAnchor="end"
                  fill={CHART_COLORS.muted}
                  fontSize={9}
                >
                  0%
                </text>

                {/* Weekly average dashed reference line */}
                <line
                  x1={0}
                  x2={innerW}
                  y1={yScale(avgPct)}
                  y2={yScale(avgPct)}
                  stroke={CHART_COLORS.muted}
                  strokeOpacity={0.4}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
                <text
                  x={innerW + 2}
                  y={yScale(avgPct)}
                  dy="0.35em"
                  textAnchor="start"
                  fill={CHART_COLORS.muted}
                  fontSize={8}
                >
                  avg
                </text>

                {/* Area fill */}
                <path d={areaPath} fill="url(#weeklyTrendFill)" />

                {/* Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke={CHART_COLORS.green}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Dots */}
                {parsed.map((p, i) => (
                  <circle
                    key={p.date}
                    cx={xScale(p.dateObj)}
                    cy={yScale(p.pct)}
                    r={hovered === i ? 5 : 3.5}
                    fill={rateColor(p.pct)}
                    stroke={CHART_COLORS.surface}
                    strokeWidth={1.5}
                  />
                ))}

                {/* Hover crosshair + tooltip */}
                {hoveredPoint &&
                  (() => {
                    const tooltipW = 100;
                    const halfW = tooltipW / 2;
                    const rawX = xScale(hoveredPoint.dateObj);
                    const clampedX = Math.max(
                      halfW,
                      Math.min(innerW - halfW, rawX),
                    );
                    const tooltipY = Math.max(14, yScale(hoveredPoint.pct) - 16);
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
                        <g transform={`translate(${clampedX},${tooltipY})`}>
                          <rect
                            x={-halfW}
                            y={-12}
                            width={tooltipW}
                            height={16}
                            rx={4}
                            fill={CHART_COLORS.surface}
                            fillOpacity={0.95}
                            stroke={CHART_COLORS.muted}
                            strokeOpacity={0.25}
                          />
                          <text
                            textAnchor="middle"
                            dy="0em"
                            fill="#e5e5e5"
                            fontSize={9}
                            fontFamily="monospace"
                          >
                            {dayLabel(hoveredPoint.date)} {hoveredPoint.pct}%
                            &middot; {hoveredPoint.totalPicks}p
                          </text>
                        </g>
                      </>
                    );
                  })()}

                {/* X-axis day labels */}
                {parsed.map((p) => (
                  <text
                    key={`label-${p.date}`}
                    x={xScale(p.dateObj)}
                    y={innerH + 14}
                    textAnchor="middle"
                    fill={CHART_COLORS.muted}
                    fontSize={9}
                  >
                    {dayLabel(p.date)}
                  </text>
                ))}
              </g>
            </svg>
          )}
        </div>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: CHART_COLORS.green }}
              />
              60%+
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: CHART_COLORS.blue }}
              />
              40-59%
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: CHART_COLORS.red }}
              />
              &lt;40%
            </span>
          </div>
          <span className="tabular-nums">
            avg {avgPct}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
