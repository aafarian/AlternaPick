"use client";

import type { LivePickData } from "@/lib/cards/live-types";
import { CATEGORY_LABELS } from "@/lib/constants";
import { formatClock } from "@/lib/format";
import type { StatCategory } from "@/lib/supabase/types";
import PlayerAvatar from "@/components/players/PlayerAvatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function LivePickRow({ pick }: { pick: LivePickData }) {
  const statCat = pick.stat_category as StatCategory;
  const progressPct =
    pick.current_value !== null && pick.line > 0
      ? Math.min((pick.current_value / pick.line) * 100, 150)
      : 0;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      {/* Top row: player info */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <PlayerAvatar
            playerId={pick.player_id}
            playerName={pick.player_name}
            size="default"
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-bold">{pick.player_name}</span>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                {CATEGORY_LABELS[statCat] ?? statCat}
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px]",
                  pick.selection === "over"
                    ? "bg-neon-green/15 text-neon-green"
                    : "bg-bold-red/15 text-bold-red"
                )}
              >
                {pick.selection === "over" ? "Over" : "Under"} {pick.line}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          {pick.current_value !== null ? (
            <span
              className={cn(
                "text-xl font-black tabular-nums",
                pick.trending === "hit" && "text-neon-green",
                pick.trending === "miss" && "text-bold-red",
                pick.trending === "push" && "text-amber-400"
              )}
            >
              {pick.current_value}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">&mdash;</span>
          )}
          {pick.game_status && (
            <span className="text-[10px] text-muted-foreground">
              {pick.game_status.status === "live" ? (
                <span className="flex items-center gap-1 text-primary">
                  <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
                  {formatClock(pick.game_status.period, pick.game_status.clock)}
                </span>
              ) : pick.game_status.status === "final" ? (
                "Final"
              ) : (
                "Pre-game"
              )}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {pick.current_value !== null && (
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          {/* Line marker */}
          <div
            className="absolute top-0 z-10 h-full w-0.5 bg-foreground/50"
            style={{ left: `${Math.min(100, (100 / Math.max(progressPct, 100)) * 100)}%` }}
          />
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              pick.trending === "hit" && "bg-neon-green",
              pick.trending === "miss" && "bg-bold-red",
              pick.trending === "push" && "bg-amber-400",
              !pick.trending && "bg-muted-foreground"
            )}
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
      )}

      {/* Game score */}
      {pick.game_status && pick.game_status.status !== "scheduled" && (
        <div className="flex justify-center gap-2 text-[10px] text-muted-foreground">
          <span>
            {pick.game_status.away_tricode} {pick.game_status.away_score}
          </span>
          <span>-</span>
          <span>
            {pick.game_status.home_tricode} {pick.game_status.home_score}
          </span>
        </div>
      )}
    </div>
  );
}
