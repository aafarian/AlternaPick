"use client";

import { useState, useCallback } from "react";
import { scaleTime, scaleLinear } from "d3-scale";
import { line, area, curveMonotoneX, arc } from "d3-shape";
import { timeFormat } from "d3-time-format";
import type { TrendPoint } from "@/lib/analytics/types";
import {
  CHART_COLORS,
  rateColor,
  useResponsiveWidth,
  CHART_SECTION_CLASS,
  CHART_TITLE_CLASS,
} from "@/lib/analytics/chart-utils";

interface TrendChartProps {
  data: TrendPoint[];
}

const MARGIN = { top: 12, right: 48, bottom: 24, left: 36 };
const HEIGHT = 180;
const formatShort = timeFormat("%-m/%-d");

/** Radial gauge arc for the single-data-point case */
function RadialGauge({ pct, date, hits, total }: { pct: number; date: Date; hits: number; total: number }) {
  const size = 120;
  const r = size / 2;
  const thickness = 12;
  const outerR = r;
  const innerR = r - thickness;

  const startAngle = -Math.PI * 0.75;
  const endAngle = Math.PI * 0.75;
  const totalArc = endAngle - startAngle;

  const bgArc = arc<unknown>()
    .innerRadius(innerR)
    .outerRadius(outerR)
    .startAngle(startAngle)
    .endAngle(endAngle)
    .cornerRadius(thickness / 2);

  const valueAngle = startAngle + (pct / 100) * totalArc;
  const fgArc = arc<unknown>()
    .innerRadius(innerR)
    .outerRadius(outerR)
    .startAngle(startAngle)
    .endAngle(valueAngle)
    .cornerRadius(thickness / 2);

  const color = rateColor(pct);

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <svg width={size} height={size} viewBox={`${-r} ${-r} ${size} ${size}`}>
        {/* Background track */}
        <path d={bgArc(null as never) ?? ""} fill={CHART_COLORS.muted} fillOpacity={0.2} />
        {/* Value arc */}
        <path d={fgArc(null as never) ?? ""} fill={color} />
        {/* Center text */}
        <text
          textAnchor="middle"
          dy="0.1em"
          fill={color}
          fontSize={28}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {pct}%
        </text>
      </svg>
      <span className="text-xs text-muted-foreground">
        {formatShort(date)} — {hits}/{total} picks
      </span>
    </div>
  );
}

export default function TrendChart({ data }: TrendChartProps) {
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

  if (data.length === 0) return null;

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  // Parse dates
  const parsed = data.map((d) => ({
    ...d,
    dateObj: new Date(d.date + "T00:00:00"),
    pct: Math.round(d.rate * 100),
  }));

  // Single data point: show radial gauge
  if (parsed.length === 1) {
    const p = parsed[0];
    return (
      <div className={CHART_SECTION_CLASS}>
        <h2 className={CHART_TITLE_CLASS}>
          30-Day Trend
        </h2>
        <RadialGauge pct={p.pct} date={p.dateObj} hits={p.hits} total={p.total} />
      </div>
    );
  }

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

  // Grid lines at 0, 25, 50, 75, 100
  const gridTicks = [0, 25, 50, 75, 100];

  const hoveredPoint = hovered !== null ? parsed[hovered] : null;

  return (
    <div className={CHART_SECTION_CLASS}>
      <h2 className={CHART_TITLE_CLASS}>
        30-Day Trend
      </h2>

      <div ref={containerRef} className="w-full overflow-hidden">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            className="select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          >
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
                    x={-8}
                    y={yScale(tick)}
                    dy="0.35em"
                    textAnchor="end"
                    fill={CHART_COLORS.muted}
                    fontSize={10}
                  >
                    {tick}%
                  </text>
                </g>
              ))}

              {/* Area fill */}
              <path
                d={areaPath}
                fill={CHART_COLORS.green}
                fillOpacity={0.08}
              />

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
                  r={hovered === i ? 5 : 3}
                  fill={rateColor(p.pct)}
                  stroke={CHART_COLORS.surface}
                  strokeWidth={1.5}
                />
              ))}

              {/* Hover crosshair + tooltip */}
              {hoveredPoint && (() => {
                const tooltipW = 80;
                const halfW = tooltipW / 2;
                const rawX = xScale(hoveredPoint.dateObj);
                const clampedX = Math.max(halfW, Math.min(innerW - halfW, rawX));
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
                    <g
                      transform={`translate(${clampedX},${yScale(hoveredPoint.pct) - 14})`}
                    >
                      <rect
                        x={-halfW}
                        y={-12}
                        width={tooltipW}
                        height={16}
                        rx={4}
                        fill={CHART_COLORS.surface}
                        fillOpacity={0.9}
                        stroke={CHART_COLORS.muted}
                        strokeOpacity={0.2}
                      />
                      <text
                        textAnchor="middle"
                        dy="0em"
                        fill={CHART_COLORS.text}
                        fontSize={10}
                        fontFamily="monospace"
                      >
                        {formatShort(hoveredPoint.dateObj)} {hoveredPoint.pct}%
                      </text>
                    </g>
                  </>
                );
              })()}

              {/* X-axis labels: first and last */}
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

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
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
    </div>
  );
}
