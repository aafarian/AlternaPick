"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS } from "@/lib/constants";
import { TrendingUp, Users } from "lucide-react";
import type { MostPickedPlayer, MostPickedProp } from "@/lib/recaps/compute";

interface MostPickedCardProps {
  players: MostPickedPlayer[];
  props: MostPickedProp[];
}

const MAX_DISPLAY = 3;

function hitRateColor(rate: number): string {
  if (rate >= 0.6) return "text-neon-green";
  if (rate >= 0.4) return "text-electric-blue";
  return "text-bold-red";
}

export function MostPickedCard({ players, props }: MostPickedCardProps) {
  if (players.length === 0 && props.length === 0) return null;

  const displayPlayers = players.slice(0, MAX_DISPLAY);
  const displayProps = props.slice(0, MAX_DISPLAY);

  return (
    <Card className="border-electric-blue/30 bg-electric-blue/5">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-electric-blue/10">
            <TrendingUp className="h-4 w-4 text-electric-blue" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">Most Picked</h2>
            <p className="text-xs text-muted-foreground">
              The most popular picks of the day
            </p>
          </div>
        </div>

        {/* Most Picked Players */}
        {displayPlayers.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-electric-blue" />
              <span className="text-xs font-bold uppercase tracking-widest text-electric-blue">
                Top Players
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {displayPlayers.map((player, i) => {
                const hitPercent = Math.round(player.hitRate * 100);
                return (
                  <div
                    key={`${player.playerName}-${i}`}
                    className="rounded-lg bg-electric-blue/5 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {player.playerName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {player.pickCount} pick
                          {player.pickCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={`text-sm font-bold tabular-nums ${hitRateColor(player.hitRate)}`}
                        >
                          {hitPercent}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          hit rate
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Divider */}
        {displayPlayers.length > 0 && displayProps.length > 0 && (
          <div className="my-4 border-t border-border/40" />
        )}

        {/* Most Picked Props */}
        {displayProps.length > 0 && (
          <div className={displayPlayers.length === 0 ? "mt-4" : ""}>
            <div className="mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-electric-blue" />
              <span className="text-xs font-bold uppercase tracking-widest text-electric-blue">
                Top Props
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {displayProps.map((prop, i) => {
                const categoryLabel =
                  CATEGORY_LABELS[prop.statCategory] ?? prop.statCategory;
                const hitPercent = Math.round(prop.hitRate * 100);
                const totalSelections =
                  prop.selectionBreakdown.over +
                  prop.selectionBreakdown.under;
                const overPct =
                  totalSelections > 0
                    ? Math.round(
                        (prop.selectionBreakdown.over / totalSelections) * 100
                      )
                    : 0;

                return (
                  <div
                    key={`${prop.propId}-${i}`}
                    className="rounded-lg bg-electric-blue/5 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {prop.playerName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {prop.line} {categoryLabel}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={`text-sm font-bold tabular-nums ${hitRateColor(prop.hitRate)}`}
                        >
                          {hitPercent}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {prop.pickCount} pick
                          {prop.pickCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {overPct}% over / {100 - overPct}% under
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
