"use client";

import type { CardWithPicks } from "@/lib/cards/api";
import { useLiveStats } from "@/lib/cards/use-live-stats";
import GameScoreBanner from "./GameScoreBanner";
import LivePickRow from "./LivePickRow";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

function LiveCard({ card }: { card: CardWithPicks }) {
  const { data, isLoading, error } = useLiveStats(card.id, true);

  const date = new Date(card.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="border-amber-500/30 bg-amber-500/15 text-amber-400">
            Locked
          </Badge>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        {isLoading && !data && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {data?.has_live_games && (
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-xs font-bold text-primary">LIVE</span>
          </div>
        )}
      </CardHeader>

      {error && (
        <div className="px-4 pb-2">
          <span className="text-xs text-muted-foreground">Unable to fetch live data</span>
        </div>
      )}

      {data && (
        <>
          {data.games.length > 0 && (
            <div className="px-3 pb-2">
              <GameScoreBanner games={data.games} />
            </div>
          )}
          <CardContent className="flex flex-col gap-2 p-3">
            {data.picks.map((pick) => (
              <LivePickRow key={pick.pick_id} pick={pick} />
            ))}
          </CardContent>
        </>
      )}

      {!data && !isLoading && (
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Waiting for game data...
          </p>
        </CardContent>
      )}
    </Card>
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
