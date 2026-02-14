"use client";

import { useMemo } from "react";
import type { CardWithPicks } from "@/lib/cards/api";
import type { LiveCardData, LivePickData } from "@/lib/cards/live-types";
import { useBatchLiveStats } from "@/lib/cards/use-batch-live-stats";
import LivePickCard from "./LivePickCard";
import { Card, CardContent } from "@/components/ui/card";
import type { StatCategory, PickSelection } from "@/lib/supabase/types";

function buildFallbackPicks(picks: CardWithPicks["picks"]): LivePickData[] {
  return picks.map((pick) => {
    const hasResult = pick.result === "hit" || pick.result === "miss";
    return {
      pick_id: pick.id,
      player_name: pick.props?.player_name ?? "Unknown",
      player_id: pick.props?.player_id ?? null,
      sport: pick.props?.games?.sport,
      stat_category: (pick.props?.stat_category ?? "points") as StatCategory,
      line: pick.props?.line ?? 0,
      selection: pick.selection as PickSelection,
      current_value: pick.actual_value,
      trending: hasResult ? (pick.result as "hit" | "miss") : null,
      game_status: hasResult
        ? {
            game_id: pick.props?.game_id ?? "",
            nba_game_id: pick.props?.game_id ?? "",
            status: "final" as const,
            period: 4,
            clock: "0:00",
            home_team: "",
            away_team: "",
            home_tricode: "",
            away_tricode: "",
            home_score: 0,
            away_score: 0,
            commence_time: null,
          }
        : null,
    };
  });
}

function LiveCard({
  card,
  liveData,
  isLoading,
  hasError,
}: {
  card: CardWithPicks;
  liveData: LiveCardData | undefined;
  isLoading: boolean;
  hasError: boolean;
}) {
  return (
    <LivePickCard
      picks={liveData?.picks ?? buildFallbackPicks(card.picks)}
      hasLiveGames={liveData?.has_live_games ?? false}
      games={liveData?.games}
      statusLabel={
        <span className="text-xs text-muted-foreground">
          {card.picks.length} picks
        </span>
      }
      loading={isLoading && !liveData}
      pickCount={card.picks.length}
      error={hasError}
    />
  );
}

export default function LiveTracker({
  initialCards,
}: {
  initialCards: CardWithPicks[];
}) {
  const cardIds = useMemo(
    () => initialCards.map((c) => c.id),
    [initialCards]
  );

  const { dataMap, isLoading, error } = useBatchLiveStats(
    cardIds,
    initialCards.length > 0,
  );

  if (initialCards.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-4xl">&#x1F4E1;</span>
          <h2 className="text-lg font-semibold">No active cards</h2>
          <p className="text-sm text-muted-foreground">
            Lock in some picks to track them live during games!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {initialCards.map((card) => (
        <LiveCard
          key={card.id}
          card={card}
          liveData={dataMap.get(card.id)}
          isLoading={isLoading}
          hasError={!!error}
        />
      ))}
    </div>
  );
}
