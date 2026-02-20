"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Snowflake, Users } from "lucide-react";
import type { PlayerSpotlight } from "@/lib/recaps/compute";
import { isValidSport, SPORT_CONFIG } from "@/lib/sports/config";

interface PlayerSpotlightCardProps {
  good: PlayerSpotlight[];
  bad: PlayerSpotlight[];
}

const MAX_DISPLAY = 3;

function sportLabel(sport: string): string {
  if (isValidSport(sport)) return SPORT_CONFIG[sport].shortLabel;
  return sport.toUpperCase();
}

export function PlayerSpotlightCard({ good, bad }: PlayerSpotlightCardProps) {
  if (good.length === 0 && bad.length === 0) return null;

  const displayGood = good.slice(0, MAX_DISPLAY);
  const displayBad = bad.slice(0, MAX_DISPLAY);

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
              Player Spotlights
            </h2>
            <p className="text-xs text-muted-foreground">
              Standout performers of the day
            </p>
          </div>
          <Badge className="ml-auto shrink-0 text-[10px] bg-primary/15 text-primary border-primary/30">
            {displayGood.length + displayBad.length} player
            {displayGood.length + displayBad.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Hot Players Section */}
        {displayGood.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-neon-green" />
              <span className="text-xs font-bold uppercase tracking-widest text-neon-green">
                Hot Players
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {displayGood.map((player) => {
                const hitPercent = Math.round(player.hitRate * 100);
                return (
                  <div
                    key={`${player.playerName}-${player.sport}`}
                    className="rounded-lg bg-neon-green/5 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {player.playerName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {sportLabel(player.sport)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold tabular-nums text-neon-green">
                          {hitPercent}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {player.pickCount} pick
                          {player.pickCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {hitPercent}% hit rate across {player.pickCount} pick
                      {player.pickCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Divider */}
        {displayGood.length > 0 && displayBad.length > 0 && (
          <div className="my-4 border-t border-border/40" />
        )}

        {/* Cold Players Section */}
        {displayBad.length > 0 && (
          <div className={displayGood.length === 0 ? "mt-4" : ""}>
            <div className="mb-2 flex items-center gap-1.5">
              <Snowflake className="h-3.5 w-3.5 text-bold-red" />
              <span className="text-xs font-bold uppercase tracking-widest text-bold-red">
                Cold Players
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {displayBad.map((player) => {
                const hitPercent = Math.round(player.hitRate * 100);
                return (
                  <div
                    key={`${player.playerName}-${player.sport}`}
                    className="rounded-lg bg-bold-red/5 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {player.playerName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {sportLabel(player.sport)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold tabular-nums text-bold-red">
                          {hitPercent}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {player.pickCount} pick
                          {player.pickCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {hitPercent}% hit rate — rough night
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
