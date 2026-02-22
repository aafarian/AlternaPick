"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS } from "@/lib/constants";
import { User, TrendingUp, TrendingDown, Star } from "lucide-react";
import type { PersonalHighlight, PickHighlight } from "@/lib/recaps/compute";
import { AnimatedNumber } from "@/components/recap/AnimatedNumber";

interface YourDayProps {
  highlight: PersonalHighlight;
}

function hitRateColor(rate: number): string {
  if (rate >= 0.6) return "text-neon-green";
  if (rate >= 0.4) return "text-electric-blue";
  return "text-bold-red";
}

function formatPickRow(pick: PickHighlight): string {
  const categoryLabel =
    CATEGORY_LABELS[pick.statCategory.toLowerCase() as keyof typeof CATEGORY_LABELS] ?? pick.statCategory;
  const selectionLabel = pick.selection === "over" ? "Over" : "Under";
  const actualLabel =
    pick.actualValue !== null ? ` — actual ${pick.actualValue}` : "";
  const sign = pick.margin >= 0 ? "+" : "";
  return `${pick.playerName} ${selectionLabel} ${pick.line} ${categoryLabel}${actualLabel} (${sign}${pick.margin})`;
}

export function YourDay({ highlight }: YourDayProps) {
  const hitRatePercent = Math.round(highlight.hitRate * 100);
  const platformPercent = Math.round(highlight.platformAvgHitRate * 100);
  const delta = hitRatePercent - platformPercent;
  const deltaSign = delta >= 0 ? "+" : "";
  const deltaColor = delta >= 0 ? "text-neon-green" : "text-bold-red";
  const deltaLabel =
    delta >= 0 ? `${deltaSign}${delta}% above avg` : `${delta}% below avg`;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-lg font-bold tracking-tight">Your Day</h2>
          {highlight.featuredIn.length > 0 && (
            <Badge className="ml-auto bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
              <Star className="mr-0.5 h-3 w-3" />
              Featured in today&apos;s recap!
            </Badge>
          )}
        </div>

        {/* Stats Row */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {/* Cards Played */}
          <div className="rounded-lg border border-border/50 bg-background/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Cards Played
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
              <AnimatedNumber value={highlight.cardsPlayed} />
            </p>
          </div>

          {/* Hit Rate */}
          <div className="rounded-lg border border-border/50 bg-background/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Hit Rate
            </p>
            <p
              className={`mt-1 text-2xl font-black tabular-nums ${hitRateColor(highlight.hitRate)}`}
            >
              <AnimatedNumber value={hitRatePercent} suffix="%" />
            </p>
          </div>

          {/* vs Platform */}
          <div className="rounded-lg border border-border/50 bg-background/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              vs Platform
            </p>
            <p className={`mt-1 text-sm font-bold ${deltaColor}`}>
              {deltaLabel}
            </p>
          </div>
        </div>

        {/* Best / Worst Pick Rows */}
        <div className="mt-4 flex flex-col gap-2">
          {highlight.bestPick && (
            <div className="flex items-start gap-2 rounded-lg bg-neon-green/10 px-3 py-2">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-neon-green" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-neon-green">
                  Best Pick
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground truncate">
                  {formatPickRow(highlight.bestPick)}
                </p>
              </div>
            </div>
          )}

          {highlight.worstPick && (
            <div className="flex items-start gap-2 rounded-lg bg-bold-red/10 px-3 py-2">
              <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-bold-red" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-bold-red">
                  Worst Pick
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground truncate">
                  {formatPickRow(highlight.worstPick)}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
