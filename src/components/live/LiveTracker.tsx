"use client";

import type { CardWithPicks } from "@/lib/cards/api";
import { useLiveStats } from "@/lib/cards/use-live-stats";
import LivePickCard from "./LivePickCard";
import { Card, CardContent } from "@/components/ui/card";

function LiveCard({ card }: { card: CardWithPicks }) {
  const { data, error } = useLiveStats(card.id, true);

  return (
    <LivePickCard
      picks={data?.picks ?? []}
      hasLiveGames={data?.has_live_games ?? false}
      games={data?.games}
      statusLabel={
        <span className="text-xs text-muted-foreground">
          {card.picks.length} picks
        </span>
      }
      loading={!data && !error}
      pickCount={card.picks.length}
      error={!!error}
    />
  );
}

export default function LiveTracker({
  initialCards,
}: {
  initialCards: CardWithPicks[];
}) {
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
        <LiveCard key={card.id} card={card} />
      ))}
    </div>
  );
}
