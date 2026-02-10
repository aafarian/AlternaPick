"use client";

import type { CardWithPicks } from "@/lib/cards/api";
import { CATEGORY_LABELS } from "@/lib/constants";
import { formatClock } from "@/lib/format";
import type { StatCategory } from "@/lib/supabase/types";
import ShareButton from "@/components/cards/ShareButton";
import PlayerAvatar from "@/components/players/PlayerAvatar";
import { useLiveStats } from "@/lib/cards/use-live-stats";
import type { LivePickData } from "@/lib/cards/live-types";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function StatusBadge({ status, score, total }: { status: string; score: number; total: number }) {
  if (status === "locked") {
    return (
      <Badge variant="secondary" className="border-amber-500/30 bg-amber-500/15 text-amber-400">
        Locked
      </Badge>
    );
  }

  const isGoodScore = score >= total / 2;
  return (
    <Badge
      variant="secondary"
      className={
        isGoodScore
          ? "border-neon-green/30 bg-neon-green/15 text-neon-green"
          : "border-bold-red/30 bg-bold-red/15 text-bold-red"
      }
    >
      {score}/{total} Correct
    </Badge>
  );
}

function ResultIcon({ result }: { result: string }) {
  switch (result) {
    case "hit":
      return <CheckCircle2 className="h-4 w-4 text-neon-green" />;
    case "miss":
      return <XCircle className="h-4 w-4 text-bold-red" />;
    default:
      return <Clock className="h-4 w-4 text-amber-400" />;
  }
}

function LiveBadge({ pick }: { pick: LivePickData }) {
  if (!pick.game_status) return null;

  if (pick.game_status.status === "scheduled") {
    return (
      <span className="text-[10px] text-muted-foreground">Tip-off pending</span>
    );
  }

  if (pick.game_status.status === "live") {
    return (
      <Badge variant="secondary" className="gap-1 border-primary/30 bg-primary/10 text-[10px] text-primary">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
        {formatClock(pick.game_status.period, pick.game_status.clock)}
      </Badge>
    );
  }

  return (
    <span className="text-[10px] text-muted-foreground">Final</span>
  );
}

function LiveValue({ pick }: { pick: LivePickData }) {
  if (pick.current_value === null) return null;

  return (
    <span
      className={cn(
        "text-xs font-bold tabular-nums",
        pick.trending === "hit" && "text-neon-green",
        pick.trending === "miss" && "text-bold-red",
        pick.trending === "push" && "text-amber-400"
      )}
    >
      {pick.current_value}
    </span>
  );
}

export default function CardDetail({ card }: { card: CardWithPicks }) {
  const isLocked = card.status === "locked";
  const { data: liveData } = useLiveStats(card.id, isLocked);

  const livePickMap = new Map<string, LivePickData>();
  if (liveData) {
    for (const lp of liveData.picks) {
      livePickMap.set(lp.pick_id, lp);
    }
  }

  const date = new Date(card.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-4 py-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={card.status} score={card.score} total={card.total_picks} />
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        {card.status === "resolved" && (
          <span className="text-lg font-black tabular-nums">
            {card.score}/{card.total_picks}
          </span>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="flex flex-col gap-1 p-2">
        {card.picks.map((pick) => {
          const statCat = (pick.props?.stat_category ?? "points") as StatCategory;
          const livePick = livePickMap.get(pick.id);
          return (
            <div
              key={pick.id}
              className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-background/50 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <ResultIcon result={pick.result} />
                <PlayerAvatar
                  playerId={pick.props?.player_id ?? null}
                  playerName={pick.props?.player_name ?? "Unknown"}
                  size="sm"
                />
                <span className="truncate text-sm font-bold">
                  {pick.props?.player_name ?? "Unknown"}
                </span>
                <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                  {CATEGORY_LABELS[statCat] ?? statCat}
                </Badge>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {livePick && <LiveValue pick={livePick} />}
                <span className="text-sm font-black tabular-nums">
                  {pick.props?.line ?? "\u2014"}
                </span>
                <Badge
                  variant="secondary"
                  className={
                    pick.selection === "over"
                      ? "border-neon-green/30 bg-neon-green/15 text-neon-green"
                      : "border-bold-red/30 bg-bold-red/15 text-bold-red"
                  }
                >
                  {pick.selection === "over" ? "Over" : "Under"}
                </Badge>
                {livePick && <LiveBadge pick={livePick} />}
                {!livePick && pick.actual_value !== null && (
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    Actual: {pick.actual_value}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>

      {card.status === "resolved" && (
        <CardFooter className="justify-end px-4 py-3">
          <ShareButton cardId={card.id} />
        </CardFooter>
      )}
    </Card>
  );
}
