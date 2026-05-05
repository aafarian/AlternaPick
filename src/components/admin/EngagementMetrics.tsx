"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Repeat, Layers, BarChart3 } from "lucide-react";
import { scaleLinear } from "d3-scale";
import { line, curveMonotoneX } from "d3-shape";
import { CHART_COLORS } from "@/lib/analytics/chart-utils";
import type { EngagementMetrics as EngagementMetricsType } from "@/lib/admin/types";

interface EngagementMetricsProps {
  data: EngagementMetricsType;
}

function DauSparkline({ trend }: { trend: { date: string; count: number }[] }) {
  if (trend.length < 2) return null;
  const w = 80;
  const h = 24;
  const maxVal = Math.max(1, ...trend.map((d) => d.count));

  const xScale = scaleLinear()
    .domain([0, trend.length - 1])
    .range([2, w - 2]);
  const yScale = scaleLinear().domain([0, maxVal]).range([h - 2, 2]);

  const pathD = line<{ count: number }>()
    .x((_, i) => xScale(i))
    .y((d) => yScale(d.count))
    .curve(curveMonotoneX)(trend);

  return (
    <svg width={w} height={h} className="mt-1">
      <path d={pathD ?? ""} fill="none" stroke={CHART_COLORS.blue} strokeWidth={1.5} />
    </svg>
  );
}

export default function EngagementMetrics({ data }: EngagementMetricsProps) {
  const cards = [
    {
      label: "7-Day Retention",
      value: `${data.day7Retention}%`,
      subtitle: `${data.day7RetentionCohortSize} users in cohort`,
      icon: Repeat,
    },
    {
      label: "Cards / Active User",
      value: `${data.avgCardsPerActiveUser}`,
      subtitle: `${data.avgPicksPerActiveUser} picks / user`,
      icon: Layers,
    },
    {
      label: "DAU / MAU",
      value: `${data.dauMauRatio}%`,
      subtitle: "Signups (14d)",
      icon: BarChart3,
      sparkline: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="py-4">
            <CardHeader className="px-4 pb-0 pt-0 gap-1">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pt-1 pb-0">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold tracking-tight">{c.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.subtitle}
                  </p>
                </div>
                {c.sparkline && <DauSparkline trend={data.dauTrend} />}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
