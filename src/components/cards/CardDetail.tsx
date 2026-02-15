"use client";

import type { CardWithPicks } from "@/lib/cards/api";
import { toLivePickData } from "@/lib/cards/live-types";
import type { LivePickData } from "@/lib/cards/live-types";
import ShareButton from "@/components/cards/ShareButton";
import { useLiveStats } from "@/lib/cards/use-live-stats";
import GameScoreBanner from "@/components/live/GameScoreBanner";
import LivePickRow from "@/components/live/LivePickRow";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

export default function CardDetail({ card }: { card: CardWithPicks }) {
  const isLocked = card.status === "locked";
  // Also fetch live data for resolved cards with missing actual_value —
  // resolution may have run before boxscore data was available on ESPN.
  // The hook auto-stops polling once has_live_games is false (one-shot fetch).
  const hasMissingValues =
    card.status === "resolved" &&
    card.picks.some(
      (p) => p.actual_value === null && (p.result === "hit" || p.result === "miss")
    );
  const { data: liveData } = useLiveStats(card.id, isLocked || hasMissingValues);

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
        {liveData?.has_live_games && (
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-foreground" />
            <span className="text-xs font-bold text-foreground">LIVE</span>
          </div>
        )}
      </CardHeader>

      {liveData && liveData.games.length > 0 && (
        <div className="px-3 pb-2">
          <GameScoreBanner games={liveData.games} />
        </div>
      )}

      <Separator />

      <CardContent className="flex flex-col gap-0 p-0">
        {card.picks.map((pick) => {
          // Use live data if available, otherwise convert the static pick
          const livePick = livePickMap.get(pick.id) ?? toLivePickData({
            id: pick.id,
            selection: pick.selection,
            result: pick.result,
            actual_value: pick.actual_value,
            prop: pick.props ? {
              id: pick.prop_id,
              player_name: pick.props.player_name,
              player_id: pick.props.player_id,
              player_team: pick.props.player_team,
              player_position: pick.props.player_position,
              stat_category: pick.props.stat_category,
              line: pick.props.line,
              game_id: pick.props.game_id,
              games: pick.props.games,
            } : null,
          });

          return <LivePickRow key={pick.id} pick={livePick} />;
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
