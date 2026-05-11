"use client";

import { CATEGORY_LABELS } from "@/lib/constants";
import type { CategoryStats } from "@/lib/analytics/types";
import type { StatCategory } from "@/lib/supabase/types";
import {
  rateColor,
  getCategorySport,
  CHART_SECTION_CLASS,
  CHART_TITLE_CLASS,
} from "@/lib/analytics/chart-utils";
import { cn } from "@/lib/utils";

interface CategoryChartProps {
  data: CategoryStats[];
}

/** Group categories by sport for visual separation. */
function groupBySport(data: CategoryStats[]): { sport: string; items: CategoryStats[] }[] {
  const groups = new Map<string, CategoryStats[]>();
  for (const item of data) {
    const sport = getCategorySport(item.category) ?? "Other";
    const list = groups.get(sport) ?? [];
    list.push(item);
    groups.set(sport, list);
  }
  return Array.from(groups, ([sport, items]) => ({ sport, items }));
}

export default function CategoryChart({ data }: CategoryChartProps) {
  if (data.length === 0) return null;

  const groups = groupBySport(data);

  return (
    <div className={CHART_SECTION_CLASS}>
      <h2 className={CHART_TITLE_CLASS}>Hit Rate by Category</h2>

      <div className="flex flex-col gap-3">
        {groups.map(({ sport, items }) => (
          <div key={sport}>
            {/* Sport group header */}
            {groups.length > 1 && (
              <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
                {sport}
              </p>
            )}

            <div className="flex flex-col gap-1">
              {items.map((item, i) => {
                const pct = Math.round(item.rate * 100);
                const label = CATEGORY_LABELS[item.category as StatCategory] ?? item.category;
                const color = rateColor(pct);

                return (
                  <div key={item.category} className="flex items-center gap-2">
                    {/* Category name */}
                    <span className="w-20 shrink-0 truncate text-right text-[11px] font-medium text-muted-foreground">
                      {label}
                    </span>

                    {/* Bar */}
                    <div className="relative h-[18px] flex-1 overflow-hidden rounded bg-white/[0.04]">
                      <div
                        className="absolute inset-y-0 left-0 rounded transition-all duration-700 ease-out"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: color,
                          opacity: 0.7,
                          transitionDelay: `${i * 30}ms`,
                        }}
                      />
                      <span className={cn(
                        "relative z-[1] flex h-full items-center px-1.5 text-[9px] font-bold tabular-nums",
                        pct > 12 ? "text-white" : "text-muted-foreground",
                      )}>
                        {pct}%
                      </span>
                    </div>

                    {/* Count */}
                    <span className="w-12 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">
                      {item.hits}/{item.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
