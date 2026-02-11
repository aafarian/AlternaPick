"use client";

import { useMemo } from "react";
import type { CardWithPicks } from "@/lib/cards/api";
import type { LiveCardData } from "@/lib/cards/live-types";
import { useBatchLiveStats } from "@/lib/cards/use-batch-live-stats";
import LivePickCard from "./LivePickCard";
import { Card, CardContent } from "@/components/ui/card";

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
      picks={liveData?.picks ?? []}
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
