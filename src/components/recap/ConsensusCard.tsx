"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS } from "@/lib/constants";
import { Users, Check, X } from "lucide-react";
import type { ConsensusPick } from "@/lib/recaps/compute";
import type { StatCategory } from "@/lib/supabase/types";

interface ConsensusCardProps {
  picks: ConsensusPick[];
}

const MAX_DISPLAY = 6;

export function ConsensusCard({ picks }: ConsensusCardProps) {
  if (picks.length === 0) return null;

  const displayPicks = picks.slice(0, MAX_DISPLAY);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">
              Consensus Picks
            </h2>
            <p className="text-xs text-muted-foreground">
              What the crowd agreed on
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {displayPicks.map((pick) => {
            const pct = Math.round(pick.dominantPct * 100);
            const categoryLabel =
              CATEGORY_LABELS[pick.statCategory.toLowerCase() as StatCategory] ??
              pick.statCategory;

            return (
              <div
                key={pick.propId}
                className={`rounded-lg px-3 py-2.5 ${
                  pick.wasCorrect ? "bg-neon-green/5" : "bg-bold-red/5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {pick.playerName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {pick.line} {categoryLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      className={`text-[10px] ${
                        pick.dominantSide === "over"
                          ? "bg-neon-green/15 text-neon-green border-neon-green/30"
                          : "bg-electric-blue/15 text-electric-blue border-electric-blue/30"
                      }`}
                    >
                      {pct}% {pick.dominantSide.toUpperCase()}
                    </Badge>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        pick.wasCorrect
                          ? "bg-neon-green/20 text-neon-green"
                          : "bg-bold-red/20 text-bold-red"
                      }`}
                    >
                      {pick.wasCorrect ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Consensus bar */}
                <div className="mt-2 h-1.5 w-full rounded-full bg-border/30">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pick.wasCorrect ? "bg-neon-green/60" : "bg-bold-red/60"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">
                    {pick.pickCount} pick{pick.pickCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {pick.wasCorrect ? "Crowd was right" : "Crowd was wrong"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
