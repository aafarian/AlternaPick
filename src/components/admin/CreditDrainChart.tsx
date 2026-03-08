"use client";

import { useState, useCallback } from "react";
import { scaleTime, scaleLinear } from "d3-scale";
import { line, area, curveMonotoneX } from "d3-shape";
import {
  CHART_COLORS,
  useResponsiveWidth,
} from "@/lib/analytics/chart-utils";

interface CreditDrainPoint {
  hour: string;
  credits: number;
}

interface CreditDrainChartProps {
  data: CreditDrainPoint[];
}

const MARGIN = { top: 12, right: 40, bottom: 24, left: 32 };
const HEIGHT = 140;

function formatHour(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", hour12: true });
}

export default function CreditDrainChart({ data }: CreditDrainChartProps) {
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

  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No credit usage in the last 24h
      </p>
    );
  }

  const parsed = data.map((d) => ({
    ...d,
    dateObj: new Date(d.hour),
  }));

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const maxCredits = Math.max(...parsed.map((d) => d.credits));
  const yMax = Math.max(10, Math.ceil(maxCredits / 5) * 5);

  const avg = Math.round(
    parsed.reduce((sum, p) => sum + p.credits, 0) / parsed.length,
  );

  // Single data point: just show the number
  if (parsed.length === 1) {
    const p = parsed[0];
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="text-2xl font-bold tabular-nums">
          {p.credits}
        </span>
        <span className="text-xs text-muted-foreground">
          credits at {formatHour(p.dateObj)}
        </span>
      </div>
    );
  }

  const xScale = scaleTime()
    .domain([parsed[0].dateObj, parsed[parsed.length - 1].dateObj])
    .range([0, innerW]);

  const yScale = scaleLinear().domain([0, yMax]).range([innerH, 0]);

  const lineGen = line<(typeof parsed)[0]>()
    .x((d) => xScale(d.dateObj))
    .y((d) => yScale(d.credits))
    .curve(curveMonotoneX);

  const areaGen = area<(typeof parsed)[0]>()
    .x((d) => xScale(d.dateObj))
    .y0(innerH)
    .y1((d) => yScale(d.credits))
    .curve(curveMonotoneX);

  const linePath = lineGen(parsed) ?? "";
  const areaPath = areaGen(parsed) ?? "";

  const gridTicks = [0, Math.round(yMax / 2), yMax];

  const hoveredPoint = hovered !== null ? parsed[hovered] : null;

  /** Color a dot red if it's a spike (>2x average) */
  function dotColor(credits: number): string {
    if (avg > 0 && credits > avg * 2) return CHART_COLORS.red;
    return CHART_COLORS.blue;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">Credits/Hour (24h)</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          avg {avg}/hr
        </p>
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
              <linearGradient
                id="creditDrainFill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={CHART_COLORS.blue}
                  stopOpacity={0.2}
                />
                <stop
                  offset="100%"
                  stopColor={CHART_COLORS.blue}
                  stopOpacity={0.02}
                />
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
                    strokeOpacity={0.15}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={-6}
                    y={yScale(tick)}
                    dy="0.35em"
                    textAnchor="end"
                    fill={CHART_COLORS.muted}
                    fontSize={9}
                  >
                    {tick}
                  </text>
                </g>
              ))}

              {/* Average dashed line */}
              <line
                x1={0}
                x2={innerW}
                y1={yScale(avg)}
                y2={yScale(avg)}
                stroke={CHART_COLORS.muted}
                strokeOpacity={0.4}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <text
                x={innerW + 2}
                y={yScale(avg)}
                dy="0.35em"
                textAnchor="start"
                fill={CHART_COLORS.muted}
                fontSize={8}
              >
                avg
              </text>

              {/* Area fill */}
              <path d={areaPath} fill="url(#creditDrainFill)" />

              {/* Line */}
              <path
                d={linePath}
                fill="none"
                stroke={CHART_COLORS.blue}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Dots */}
              {parsed.map((p, i) => (
                <circle
                  key={p.hour}
                  cx={xScale(p.dateObj)}
                  cy={yScale(p.credits)}
                  r={hovered === i ? 5 : 3}
                  fill={dotColor(p.credits)}
                  stroke={CHART_COLORS.surface}
                  strokeWidth={1.5}
                />
              ))}

              {/* Hover tooltip */}
              {hoveredPoint &&
                (() => {
                  const tooltipW = 90;
                  const halfW = tooltipW / 2;
                  const rawX = xScale(hoveredPoint.dateObj);
                  const clampedX = Math.max(
                    halfW,
                    Math.min(innerW - halfW, rawX),
                  );
                  const tooltipY = Math.max(
                    14,
                    yScale(hoveredPoint.credits) - 16,
                  );
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
                          fill={CHART_COLORS.text}
                          fontSize={9}
                          fontFamily="monospace"
                        >
                          {formatHour(hoveredPoint.dateObj)} &middot;{" "}
                          {hoveredPoint.credits} credits
                        </text>
                      </g>
                    </>
                  );
                })()}

              {/* X-axis labels: first and last */}
              <text
                x={0}
                y={innerH + 14}
                textAnchor="start"
                fill={CHART_COLORS.muted}
                fontSize={9}
              >
                {formatHour(parsed[0].dateObj)}
              </text>
              <text
                x={innerW}
                y={innerH + 14}
                textAnchor="end"
                fill={CHART_COLORS.muted}
                fontSize={9}
              >
                {formatHour(parsed[parsed.length - 1].dateObj)}
              </text>
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
