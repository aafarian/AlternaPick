"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
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
import CardHeatScoreBadge from "@/components/cards/CardHeatScoreBadge";
import { CATEGORY_LABELS, CATEGORY_SHORT_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
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
      line: pick.adjusted_line ?? pick.props?.line ?? 0,
      notch: pick.notch ?? 0,
      selection: pick.selection as PickSelection,
      current_value: pick.actual_value,
      trending: hasResult ? (pick.result as "hit" | "miss" | "push" | "dnp") : null,
      heat_score: pick.heat_score,
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
  categoryStats,
}: {
  card: CardWithPicks;
  liveData: LiveCardData | undefined;
  hasFetched: boolean;
  hasError: boolean;
  categoryStats?: Map<string, { rate: number; total: number }>;
}) {
  // Render card structure immediately using static pick data from the server.
  // Live values (current_value, game scores) overlay when they arrive —
  // LivePickRow already handles the "no value yet" state with a dash + spinner.
  const picks = liveData?.picks ?? buildFallbackPicks(card.picks);

  const statsPanel = categoryStats && categoryStats.size > 0 && (
    <div className="hidden border-l border-border lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:px-5">
      {card.picks.map((pick) => {
        const cat = pick.props?.stat_category ?? "";
        const stats = categoryStats.get(cat);
        if (!stats) return <div key={pick.id} className="flex h-[54px] items-center" />;
        const pct = Math.round(stats.rate * 100);
        const catShort = CATEGORY_SHORT_LABELS[pick.props?.stat_category as keyof typeof CATEGORY_SHORT_LABELS] ?? cat;
        return (
          <div key={pick.id} className="flex h-[54px] items-center gap-2">
            <span className={cn(
              "text-lg font-black tabular-nums shrink-0",
              pct >= 60 ? "text-emerald-500" : pct >= 40 ? "text-blue-400" : "text-red-400"
            )}>
              {pct}%
            </span>
            <span className="text-[10px] leading-tight text-muted-foreground">
              {catShort} hit rate · {stats.total} picks
            </span>
          </div>
        );
      })}
    </div>
  );

  const content = (
    <div className="flex">
      <div className="flex-1 min-w-0">
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
          wagerLabel={
            (card.fire_token_wager != null || card.heat_score != null) ? (
              <CardHeatScoreBadge
                heatScore={card.heat_score}
                wager={card.fire_token_wager}
                payout={card.fire_token_payout}
                cardSize={card.card_size}
                pickNotches={card.picks.map((p) => p.notch ?? 0)}
                score={card.score}
                totalPicks={card.total_picks}
              />
            ) : undefined
          }
          isWagered={card.fire_token_wager != null}
          loading={!hasFetched}
          pickCount={card.picks.length}
          error={hasError}
        />
      </div>
      {statsPanel}
    </div>
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

  // Fetch category stats once for side panel
  const [categoryStats, setCategoryStats] = useState<Map<string, { rate: number; total: number }> | undefined>();
  useEffect(() => {
    fetch("/api/analytics?section=categories")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.categories) return;
        const map = new Map<string, { rate: number; total: number }>();
        for (const c of data.categories as Array<{ category: string; rate: number; total: number }>) {
          map.set(c.category, { rate: c.rate, total: c.total });
        }
        setCategoryStats(map);
      })
      .catch(() => { /* non-blocking */ });
  }, []);

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
    <AnimatedList className="grid grid-cols-1 gap-4 max-w-4xl" staggerDelay={0.06}>
      {initialCards.map((card) => (
        <LiveCard
          key={card.id}
          card={card}
          liveData={dataMap.get(card.id)}
          hasFetched={hasFetched}
          hasError={!!error}
          categoryStats={categoryStats}
        />
      ))}
    </AnimatedList>
  );
}
