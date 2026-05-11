"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import type { GameMode } from "@/lib/supabase/types";
import type { SportKey } from "@/lib/sports";
import type {
  CategoryStats,
  PlayerStats,
  DirectionStats,
  TrendPoint,
  CoinTrendPoint,
  CardSizeStats,
  TeamStats,
  ScoreDistributionEntry,
  GameModeStats as GameModeStatsType,
  CardHistoryItem,
} from "@/lib/analytics/types";
import { STAT_CARD_CLASS } from "@/lib/analytics/chart-utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";
import { MarkPageSeen } from "@/components/layout/MarkPageSeen";
import ModeFilter from "./ModeFilter";
import SportFilter from "./SportFilter";
import CardHistoryModal from "./CardHistoryModal";
import CategoryChart from "./CategoryChart";
import PlayerHitRate from "./PlayerHitRate";
import DirectionSplit from "./DirectionSplit";
import TrendChart from "./TrendChart";
import CoinTrendChart from "./CoinTrendChart";
import CardSizeChart from "./CardSizeChart";
import TeamHitRate from "./TeamHitRate";
import ScoreDistribution from "./ScoreDistribution";
import GameModeStats from "./GameModeStats";

export interface AnalyticsData {
  categories: CategoryStats[];
  players: PlayerStats[];
  directions: DirectionStats;
  trend: TrendPoint[];
  coinTrend: CoinTrendPoint[];
  cardSizes: CardSizeStats[];
  teams: TeamStats[];
  scoreDistribution: ScoreDistributionEntry[];
  gameModes: GameModeStatsType[];
  cardHistory: CardHistoryItem[];
}

interface AnalyticsPageClientProps {
  initialData: AnalyticsData;
  initialMode: GameMode | "all";
  initialSport: string;
  availableModes: GameMode[];
}

function computeStats(data: AnalyticsData) {
  const totalPicks = data.categories.reduce((sum, c) => sum + c.total, 0);
  const totalHits = data.categories.reduce((sum, c) => sum + c.hits, 0);
  const overallRate = totalPicks > 0 ? Math.round((totalHits / totalPicks) * 100) : 0;
  const totalCards = data.cardSizes.reduce((sum, s) => sum + s.cards, 0);

  let bestStreak = 0;
  let currentStreak = 0;
  for (const point of data.trend) {
    if (point.rate >= 0.5) {
      currentStreak += 1;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  return { totalPicks, totalHits, overallRate, totalCards, bestStreak };
}

export default function AnalyticsPageClient({
  initialData,
  initialMode,
  initialSport,
  availableModes,
}: AnalyticsPageClientProps) {
  const [mode, setMode] = useState<GameMode | "all">(initialMode);
  const [sport, setSport] = useState<string>(initialSport);
  const [data, setData] = useState<AnalyticsData>(initialData);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (newMode: GameMode | "all", newSport: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (newMode !== "all") params.set("mode", newMode);
      if (newSport !== "all") params.set("sport", newSport);
      const qs = params.toString();

      const res = await fetch(`/api/analytics${qs ? `?${qs}` : ""}`);
      if (!res.ok) return;
      const json = await res.json();

      setData({
        categories: json.categories ?? [],
        players: json.players ?? [],
        directions: json.directions ?? { over: { hits: 0, total: 0, rate: 0 }, under: { hits: 0, total: 0, rate: 0 } },
        trend: json.trend ?? [],
        coinTrend: json.coinTrend ?? [],
        cardSizes: json.cardSizes ?? [],
        teams: json.teams ?? [],
        scoreDistribution: json.scoreDistribution ?? [],
        gameModes: json.gameModes ?? [],
        cardHistory: json.cardHistory ?? [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleModeChange = useCallback((newMode: GameMode | "all") => {
    setMode(newMode);
    fetchData(newMode, sport);

    const params = new URLSearchParams();
    if (newMode !== "all") params.set("mode", newMode);
    if (sport !== "all") params.set("sport", sport);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/analytics?${qs}` : "/analytics");
  }, [sport, fetchData]);

  const handleSportChange = useCallback((newSport: SportKey | "all") => {
    setSport(newSport);
    fetchData(mode, newSport);

    const params = new URLSearchParams();
    if (mode !== "all") params.set("mode", mode);
    if (newSport !== "all") params.set("sport", newSport);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/analytics?${qs}` : "/analytics");
  }, [mode, fetchData]);

  const { totalPicks, totalHits, overallRate, totalCards, bestStreak } = computeStats(data);
  const isEmpty = totalPicks === 0;
  const isAllMode = mode === "all";
  const hasFilters = mode !== "all" || sport !== "all";

  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden pb-8">
      <MarkPageSeen type="analytics" />

      {/* Filters */}
      <div className="flex flex-col gap-2 pt-1">
        <ModeFilter activeMode={mode} availableModes={availableModes} onSelect={handleModeChange} />
        <SportFilter activeSport={sport} onSelect={handleSportChange} />
      </div>

      {/* Animated content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${mode}-${sport}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col gap-4"
        >
          {loading ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                <Skeleton className="h-80 rounded-2xl" />
                <Skeleton className="h-80 rounded-2xl" />
                <Skeleton className="h-80 rounded-2xl" />
              </div>
            </div>
          ) : isEmpty ? (
            <AnimatedEmptyState
              icon={<BarChart3 className="h-8 w-8" />}
              title={`No data${hasFilters ? " for this filter combo" : ""}`}
              description={
                !hasFilters
                  ? "Play some games to see your analytics! Once your cards are resolved, your hit rates and trends will appear here."
                  : "No resolved cards for these filters yet. Try a different combination or play more games!"
              }
              action={
                <Link href="/props">
                  <Button variant="default" size="sm">Browse Props</Button>
                </Link>
              }
            />
          ) : (
            <>
              {/* Overview Stats */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                <CardHistoryModal cards={data.cardHistory} totalCards={totalCards} isAllMode={isAllMode} />
                <div className={STAT_CARD_CLASS}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hit Rate</p>
                  <p className={`mt-1 text-2xl font-black tabular-nums ${overallRate >= 60 ? "text-neon-green" : overallRate >= 40 ? "text-electric-blue" : "text-bold-red"}`}>
                    {overallRate}%
                  </p>
                  <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{totalHits}/{totalPicks} picks</p>
                </div>
                <div className={STAT_CARD_CLASS}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Best Streak</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-amber-400">{bestStreak} day{bestStreak !== 1 ? "s" : ""}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">winning days</p>
                </div>
                <div className={STAT_CARD_CLASS}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hits</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-neon-green">{totalHits}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">correct picks</p>
                </div>
                <div className={STAT_CARD_CLASS}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Misses</p>
                  <p className="mt-1 text-2xl font-black tabular-nums text-bold-red">{totalPicks - totalHits}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">incorrect picks</p>
                </div>
              </div>

              {/* Main charts — lg: 3-col, below: 2-col / 1-col */}
              <div className="hidden gap-3 lg:grid lg:grid-cols-3">
                <div className="min-w-0"><PlayerHitRate data={data.players} /></div>
                <div className="flex min-w-0 h-full flex-col gap-3">
                  <div className="min-w-0 flex-1"><DirectionSplit data={data.directions} /></div>
                  <div className="min-w-0 flex-1"><TrendChart data={data.trend} /></div>
                </div>
                <div className="min-w-0"><CategoryChart data={data.categories} /></div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:hidden">
                <div className="min-w-0"><PlayerHitRate data={data.players} /></div>
                <div className="min-w-0"><DirectionSplit data={data.directions} /></div>
                <div className="min-w-0"><TrendChart data={data.trend} /></div>
                <div className="min-w-0 md:col-span-2"><CategoryChart data={data.categories} /></div>
              </div>

              {/* Secondary charts */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.coinTrend.length >= 2 && (
                  <div className="min-w-0"><CoinTrendChart data={data.coinTrend} /></div>
                )}
                <div className="min-w-0"><CardSizeChart data={data.cardSizes} /></div>
                {isAllMode && (
                  <div className="min-w-0"><GameModeStats data={data.gameModes} /></div>
                )}
                <div className="min-w-0"><ScoreDistribution data={data.scoreDistribution} /></div>
                <div className="min-w-0"><TeamHitRate data={data.teams} /></div>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
