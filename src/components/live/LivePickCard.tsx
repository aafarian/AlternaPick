"use client";

import type { LivePickData, LiveGameStatus } from "@/lib/cards/live-types";
import GameScoreBanner from "./GameScoreBanner";
import LivePickRow from "./LivePickRow";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function PickRowSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-2.5 w-14" />
        </div>
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

interface LivePickCardProps {
  picks: LivePickData[];
  hasLiveGames?: boolean;
  games?: LiveGameStatus[];
  statusLabel?: React.ReactNode;
  /** Wager/multiplier info displayed on the right side of the header. */
  wagerLabel?: React.ReactNode;
  /** True when the card has an actual token wager (shows WAGER badge + orange border) */
  isWagered?: boolean;
  loading?: boolean;
  pickCount?: number;
  error?: boolean;
  /** When true, shows game score section (banner + skeleton). Default true. */
  showGameScores?: boolean;
  /** Optional side panel rendered to the right of pick rows (stats panel). */
  sidePanel?: React.ReactNode;
}

export default function LivePickCard({
  picks,
  hasLiveGames = false,
  games,
  statusLabel,
  wagerLabel,
  isWagered = false,
  loading = false,
  pickCount = 0,
  error = false,
  showGameScores = true,
  sidePanel,
}: LivePickCardProps) {
  return (
    <Card className={cn(
      "overflow-hidden bg-card border-border",
      isWagered && "border-t-2 border-t-orange-500",
    )}>
      {/* Header row 1: status + dots */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2.5">
          {hasLiveGames && (
            <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              <span className="text-[10px] font-bold tracking-wide text-primary">
                LIVE
              </span>
            </div>
          )}
          {statusLabel}
          {isWagered && (
            <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-400">
              Wager
            </span>
          )}
          {loading && picks.length > 0 && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
          )}
        </div>

        {/* Dot scoreboard — always on row 1 */}
        {picks.length > 0 && (
          <div className="flex items-center gap-1">
            {picks.map((pick) => (
              <div
                key={pick.pick_id}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  pick.trending === "hit" && "bg-neon-green",
                  pick.trending === "miss" && "bg-bold-red",
                  pick.trending === "push" && "bg-amber-400",
                  !pick.trending && "bg-secondary"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Header row 2: wager info (only if wagered) */}
      {wagerLabel && (
        <div className="px-4 pb-2">
          {wagerLabel}
        </div>
      )}

      {error && (
        <div className="px-4 pb-2">
          <span className="text-xs text-muted-foreground">
            Unable to fetch live data
          </span>
        </div>
      )}

      {/* Game score skeletons while loading */}
      {showGameScores && loading && !games && (
        <div className="flex gap-2 px-4 pb-2">
          <Skeleton className="h-[50px] w-[100px] shrink-0 rounded-lg" />
          <Skeleton className="h-[50px] w-[100px] shrink-0 rounded-lg" />
        </div>
      )}

      {/* Game scores */}
      {showGameScores && games && games.length > 0 && (
        <div className="px-4 pb-2">
          <GameScoreBanner games={games} />
        </div>
      )}

      {/* Pick rows + optional side panel */}
      {picks.length > 0 && (
        <>
          <Separator className="opacity-30" />
          <div className="flex">
            <div className={cn("flex-1 min-w-0 flex flex-col transition-opacity", loading && "opacity-60")}>
              {picks.map((pick, i) => (
                <div key={pick.pick_id}>
                  {i > 0 && <Separator className="ml-4 opacity-20" />}
                  <LivePickRow pick={pick} variant="condensed" />
                </div>
              ))}
            </div>
            {sidePanel}
          </div>
        </>
      )}

      {/* Loading skeletons */}
      {loading && picks.length === 0 && (
        <>
          <Separator className="opacity-30" />
          <div className="flex flex-col">
            {Array.from({ length: pickCount }, (_, i) => (
              <div key={i}>
                {i > 0 && <Separator className="ml-4 opacity-20" />}
                <PickRowSkeleton />
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
