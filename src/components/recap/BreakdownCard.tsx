"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CATEGORY_LABELS } from "@/lib/constants";
import { BarChart3, Layers } from "lucide-react";
import { isValidSport, SPORT_CONFIG } from "@/lib/sports/config";
import type { BreakdownEntry } from "@/lib/recaps/compute";
import type { StatCategory } from "@/lib/supabase/types";

interface BreakdownCardProps {
  statCategories: BreakdownEntry[];
  sports: BreakdownEntry[];
}

function hitRateColor(rate: number): string {
  if (rate >= 0.6) return "text-neon-green";
  if (rate >= 0.4) return "text-electric-blue";
  return "text-bold-red";
}

function hitRateBarColor(rate: number): string {
  if (rate >= 0.6) return "bg-neon-green/60";
  if (rate >= 0.4) return "bg-electric-blue/60";
  return "bg-bold-red/60";
}

function categoryLabel(key: string): string {
  if (key in CATEGORY_LABELS) {
    return CATEGORY_LABELS[key as StatCategory];
  }
  return key;
}

function sportLabel(key: string): string {
  if (isValidSport(key)) return SPORT_CONFIG[key].shortLabel;
  return key.toUpperCase();
}

function BreakdownRow({
  label,
  hitRate,
  pickCount,
}: {
  label: string;
  hitRate: number;
  pickCount: number;
}) {
  const percent = Math.round(hitRate * 100);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground truncate">
          {label}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {pickCount} pick{pickCount !== 1 ? "s" : ""}
          </span>
          <span
            className={`text-sm font-bold tabular-nums ${hitRateColor(hitRate)}`}
          >
            {percent}%
          </span>
        </div>
      </div>
      {/* Horizontal bar */}
      <div className="h-1.5 w-full rounded-full bg-border/30">
        <div
          className={`h-full rounded-full transition-all ${hitRateBarColor(hitRate)}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function BreakdownCard({
  statCategories,
  sports,
}: BreakdownCardProps) {
  if (statCategories.length === 0 && sports.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">Breakdowns</h2>
            <p className="text-xs text-muted-foreground">
              Hit rates across categories and sports
            </p>
          </div>
        </div>

        {/* By Category */}
        {statCategories.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                By Category
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {statCategories.map((entry) => (
                <BreakdownRow
                  key={entry.key}
                  label={categoryLabel(entry.key)}
                  hitRate={entry.hitRate}
                  pickCount={entry.pickCount}
                />
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        {statCategories.length > 0 && sports.length > 0 && (
          <div className="my-4 border-t border-border/40" />
        )}

        {/* By Sport */}
        {sports.length > 0 && (
          <div className={statCategories.length === 0 ? "mt-4" : ""}>
            <div className="mb-2 flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                By Sport
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {sports.map((entry) => (
                <BreakdownRow
                  key={entry.key}
                  label={sportLabel(entry.key)}
                  hitRate={entry.hitRate}
                  pickCount={entry.pickCount}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
