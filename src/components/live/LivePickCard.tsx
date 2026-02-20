"use client";

import type { LivePickData, LiveGameStatus } from "@/lib/cards/live-types";
import GameScoreBanner from "./GameScoreBanner";
import LivePickRow from "./LivePickRow";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  loading?: boolean;
  pickCount?: number;
  error?: boolean;
  /** When true, shows game score section (banner + skeleton). Default true. */
  showGameScores?: boolean;
}

export default function LivePickCard({
  picks,
  hasLiveGames = false,
  games,
  statusLabel,
  loading = false,
  pickCount = 0,
  error = false,
  showGameScores = true,
}: LivePickCardProps) {
  return (
    <Card className="overflow-hidden border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
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
        </div>

        {/* Dot scoreboard */}
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

      {/* Pick rows */}
      {picks.length > 0 && (
        <>
          <Separator className="opacity-30" />
          <div className="flex flex-col">
            {picks.map((pick, i) => (
              <div key={pick.pick_id}>
                {i > 0 && <Separator className="ml-4 opacity-20" />}
                <LivePickRow pick={pick} />
              </div>
            ))}
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
