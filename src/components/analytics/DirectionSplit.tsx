"use client";

import { arc as d3Arc, pie as d3Pie } from "d3-shape";
import type { DirectionStats } from "@/lib/analytics/types";
import { CHART_COLORS } from "@/lib/analytics/chart-utils";

interface DirectionSplitProps {
  data: DirectionStats;
}

const DONUT_SIZE = 140;
const THICKNESS = 18;

export default function DirectionSplit({ data }: DirectionSplitProps) {
  const overPct = Math.round(data.over.rate * 100);
  const underPct = Math.round(data.under.rate * 100);
  const totalPicks = data.over.total + data.under.total;

  if (totalPicks === 0) return null;

  const overShare = data.over.total;
  const underShare = data.under.total;

  const r = DONUT_SIZE / 2;
  const outerR = r;
  const innerR = r - THICKNESS;

  const pieGen = d3Pie<number>()
    .sort(null)
    .value((d) => d);

  const arcs = pieGen([overShare, underShare]);

  const arcGen = d3Arc<(typeof arcs)[0]>()
    .innerRadius(innerR)
    .outerRadius(outerR)
    .cornerRadius(3)
    .padAngle(0.03);

  const colors = [CHART_COLORS.green, CHART_COLORS.blue];
  const labels = ["Over", "Under"];

  const overSharePct = Math.round((overShare / totalPicks) * 100);
  const underSharePct = 100 - overSharePct;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Over vs Under
      </h2>

      <div className="flex items-center justify-center gap-6">
        {/* Donut chart */}
        <div className="relative shrink-0">
          <svg width={DONUT_SIZE} height={DONUT_SIZE}>
            <g transform={`translate(${r},${r})`}>
              {arcs.map((a, i) => (
                <path key={labels[i]} d={arcGen(a) ?? ""} fill={colors[i]} fillOpacity={0.8} />
              ))}
              {/* Center label */}
              <text
                textAnchor="middle"
                dy="-0.2em"
                fill={CHART_COLORS.text}
                fontSize={14}
                fontWeight="bold"
              >
                {overSharePct}/{underSharePct}
              </text>
              <text
                textAnchor="middle"
                dy="1.1em"
                fill={CHART_COLORS.muted}
                fontSize={9}
              >
                O / U split
              </text>
            </g>
          </svg>
        </div>

        {/* Hit-rate stats beside donut */}
        <div className="flex flex-col gap-3">
          {/* Over */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: CHART_COLORS.green }}
              />
              <span className="text-xs font-bold text-foreground">Over</span>
            </div>
            <span
              className="mt-0.5 text-xl font-black tabular-nums"
              style={{ color: CHART_COLORS.green }}
            >
              {overPct}%
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {data.over.hits}/{data.over.total} picks
            </span>
          </div>

          {/* Under */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: CHART_COLORS.blue }}
              />
              <span className="text-xs font-bold text-foreground">Under</span>
            </div>
            <span
              className="mt-0.5 text-xl font-black tabular-nums"
              style={{ color: CHART_COLORS.blue }}
            >
              {underPct}%
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {data.under.hits}/{data.under.total} picks
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
