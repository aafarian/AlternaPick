"use client";

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CardWithPicks } from "@/lib/cards/api";
import type { LiveCardData, LivePickData } from "@/lib/cards/live-types";
import { useBatchLiveStats } from "@/lib/cards/use-batch-live-stats";
import LivePickCard from "./LivePickCard";
import { Badge } from "@/components/ui/badge";
import { AnimatedList } from "@/components/motion";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";
import { Radio } from "lucide-react";
import type { StatCategory, PickSelection } from "@/lib/supabase/types";

function buildFallbackPicks(picks: CardWithPicks["picks"]): LivePickData[] {
  return picks.map((pick) => {
    const hasResult = pick.result === "hit" || pick.result === "miss" || pick.result === "push" || pick.result === "dnp";
    return {
      pick_id: pick.id,
      player_name: pick.props?.player_name ?? "Unknown",
      player_id: pick.props?.player_id ?? null,
      player_team: pick.props?.player_team ?? null,
      player_position: pick.props?.player_position ?? null,
      sport: pick.props?.games?.sport,
      stat_category: (pick.props?.stat_category ?? "points") as StatCategory,
      line: pick.props?.line ?? 0,
      selection: pick.selection as PickSelection,
      current_value: pick.actual_value,
      trending: hasResult ? (pick.result as "hit" | "miss" | "push" | "dnp") : null,
      game_status: hasResult
        ? {
            game_id: pick.props?.game_id ?? "",
            external_event_id: pick.props?.game_id ?? "",
            status: "final" as const,
            period: pick.props?.games?.sport === "soccer" ? 2 : 4,
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

function CardTypeBadge({ card }: { card: CardWithPicks }) {
  if (card.challenge_id && card.challenges) {
    const c = card.challenges;
    if (c.lobby_type === "group") {
      return (
        <Badge variant="outline" className="border-primary/30 text-primary text-[10px] px-1.5 py-0">
          Group
        </Badge>
      );
    }
    const opponent = card.user_id === c.challenger_id ? c.opponent : c.challenger;
    const name = opponent?.username ?? (c.opponent_email ? "Invited" : null);
    return (
      <Badge variant="outline" className="border-primary/30 text-primary text-[10px] px-1.5 py-0">
        H2H{name ? ` · ${name}` : ""}
      </Badge>
    );
  }
  if (card.challenge_id) {
    return (
      <Badge variant="outline" className="border-primary/30 text-primary text-[10px] px-1.5 py-0">
        H2H
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0">
      Solo
    </Badge>
  );
}

function LiveCard({
  card,
  liveData,
  hasFetched,
  hasError,
}: {
  card: CardWithPicks;
  liveData: LiveCardData | undefined;
  hasFetched: boolean;
  hasError: boolean;
}) {
  // Render card structure immediately using static pick data from the server.
  // Live values (current_value, game scores) overlay when they arrive —
  // LivePickRow already handles the "no value yet" state with a dash + spinner.
  const picks = liveData?.picks ?? buildFallbackPicks(card.picks);

  const content = (
    <LivePickCard
      picks={picks}
      hasLiveGames={liveData?.has_live_games ?? false}
      games={liveData?.games}
      statusLabel={
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CardTypeBadge card={card} />
          {card.picks.length} picks
        </span>
      }
      loading={!hasFetched}
      pickCount={card.picks.length}
      error={hasError}
    />
  );

  if (card.challenge_id) {
    return (
      <Link href={`/challenges/${card.challenge_id}`} className="block hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 rounded-xl">
        {content}
      </Link>
    );
  }

  return (
    <Link href={`/cards/${card.id}`} className="block hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 rounded-xl">
      {content}
    </Link>
  );
}

export default function LiveTracker({
  initialCards,
}: {
  initialCards: CardWithPicks[];
}) {
  const router = useRouter();

  const handleAllSettled = useCallback(() => {
    setTimeout(() => router.refresh(), 2000);
  }, [router]);

  const cardIds = useMemo(
    () => initialCards.map((c) => c.id),
    [initialCards]
  );

  const { dataMap, hasFetched, error } = useBatchLiveStats(
    cardIds,
    initialCards.length > 0,
    handleAllSettled,
  );

  if (initialCards.length === 0) {
    return (
      <AnimatedEmptyState
        icon={<Radio className="h-8 w-8" />}
        title="No active cards"
        description="Lock in some picks to track them live during games!"
      />
    );
  }

  return (
    <AnimatedList className="grid grid-cols-1 gap-4" staggerDelay={0.06}>
      {initialCards.map((card) => (
        <LiveCard
          key={card.id}
          card={card}
          liveData={dataMap.get(card.id)}
          hasFetched={hasFetched}
          hasError={!!error}
        />
      ))}
    </AnimatedList>
  );
}
