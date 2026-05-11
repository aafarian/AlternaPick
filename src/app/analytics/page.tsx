import { createClient } from "@/lib/supabase/server";
import {
  getCategoryStats,
  getPlayerStats,
  getDirectionStats,
  getTrendData,
  getCoinTrend,
  getCardSizeStats,
  getTeamStats,
  getScoreDistribution,
  getGameModeStats,
  getCardHistory,
} from "@/lib/analytics/queries";
import CategoryChart from "@/components/analytics/CategoryChart";
import PlayerHitRate from "@/components/analytics/PlayerHitRate";
import DirectionSplit from "@/components/analytics/DirectionSplit";
import TrendChart from "@/components/analytics/TrendChart";
import CoinTrendChart from "@/components/analytics/CoinTrendChart";
import CardSizeChart from "@/components/analytics/CardSizeChart";
import TeamHitRate from "@/components/analytics/TeamHitRate";
import ScoreDistribution from "@/components/analytics/ScoreDistribution";
import GameModeStats from "@/components/analytics/GameModeStats";
import CardHistoryModal from "@/components/analytics/CardHistoryModal";
import ModeFilter from "@/components/analytics/ModeFilter";
import SportFilter from "@/components/analytics/SportFilter";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isValidGameMode } from "@/lib/modes/definitions";
import { isValidSport } from "@/lib/sports";
import type { GameMode } from "@/lib/supabase/types";
import { SlideUp, FadeIn, StaggerChildren, StaggerItem, ScrollReveal } from "@/components/motion";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";
import { BarChart3 } from "lucide-react";
import { MarkPageSeen } from "@/components/layout/MarkPageSeen";

export const metadata = {
  title: "Analytics | AlternaPick",
  description: "Your prop pick analytics and hit rate breakdown.",
};

interface AnalyticsPageProps {
  searchParams: Promise<{ mode?: string; sport?: string }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const { mode: modeParam, sport: sportParam } = await searchParams;
  const mode: GameMode | "all" =
    modeParam === "all" || !modeParam ? "all" : isValidGameMode(modeParam) ? modeParam : "all";
  const sport = sportParam && isValidSport(sportParam) ? sportParam : "all";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware should redirect unauthenticated users, but guard just in case
  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">
          Sign in to view your analytics.
        </p>
        <Link href="/auth/login">
          <Button variant="default" size="sm">
            Sign In
          </Button>
        </Link>
      </div>
    );
  }

  const [
    categories,
    players,
    directions,
    trend,
    coinTrend,
    cardSizes,
    teams,
    scoreDistributionData,
    gameModes,
    cardHistory,
  ] = await Promise.all([
    getCategoryStats(supabase, user.id, mode, sport),
    getPlayerStats(supabase, user.id, 10, mode, sport),
    getDirectionStats(supabase, user.id, mode, sport),
    getTrendData(supabase, user.id, 30, mode, sport),
    getCoinTrend(supabase, user.id),
    getCardSizeStats(supabase, user.id, mode, sport),
    getTeamStats(supabase, user.id, 10, mode, sport),
    getScoreDistribution(supabase, user.id, mode, sport),
    getGameModeStats(supabase, user.id, sport),
    getCardHistory(supabase, user.id, mode, sport),
  ]);

  // Determine which modes the user actually has data for
  const availableModes: GameMode[] = ["classic"];
  for (const gm of gameModes) {
    if (gm.cards > 0 && gm.mode !== "classic") {
      availableModes.push(gm.mode);
    }
  }
  // Ensure classic is first, then preserve the order from gameModes
  const isAllMode = mode === "all";

  const totalPicks = categories.reduce((sum, c) => sum + c.total, 0);
  const totalHits = categories.reduce((sum, c) => sum + c.hits, 0);
  const overallRate =
    totalPicks > 0 ? Math.round((totalHits / totalPicks) * 100) : 0;
  const totalCards = cardSizes.reduce((sum, s) => sum + s.cards, 0);

  // Compute best streak from trend data
  let bestStreak = 0;
  let currentStreak = 0;
  for (const point of trend) {
    if (point.rate >= 0.5) {
      currentStreak += 1;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  const isEmpty = totalPicks === 0;

  const hasFilters = mode !== "all" || sport !== "all";

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <MarkPageSeen type="analytics" />
        <SlideUp>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Your prop pick performance breakdown
          </p>
        </SlideUp>
        <FadeIn delay={0.1}>
          <ModeFilter activeMode={mode} availableModes={availableModes} currentSport={sport} />
        </FadeIn>
        <FadeIn delay={0.15}>
          <SportFilter activeSport={sport} currentMode={mode} />
        </FadeIn>
        <FadeIn delay={0.2}>
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
                <Button variant="default" size="sm">
                  Browse Props
                </Button>
              </Link>
            }
          />
        </FadeIn>
      </div>
    );
  }

  const statCardClass = "h-full rounded-2xl bg-gradient-to-b from-white/[0.04] to-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)]";

  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden pb-8">
      <MarkPageSeen type="analytics" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <ModeFilter activeMode={mode} availableModes={availableModes} currentSport={sport} />
        <SportFilter activeSport={sport} currentMode={mode} />
      </div>

      {/* Overview Stats */}
      <StaggerChildren staggerDelay={0.06} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <StaggerItem>
          <CardHistoryModal
            cards={cardHistory}
            totalCards={totalCards}
            isAllMode={isAllMode}
          />
        </StaggerItem>
        <StaggerItem>
          <div className={statCardClass}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Hit Rate
            </p>
            <p
              className={`mt-1 text-2xl font-black tabular-nums ${
                overallRate >= 60
                  ? "text-neon-green"
                  : overallRate >= 40
                    ? "text-electric-blue"
                    : "text-bold-red"
              }`}
            >
              {overallRate}%
            </p>
            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
              {totalHits}/{totalPicks} picks
            </p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className={statCardClass}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Best Streak
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-amber-400">
              {bestStreak} day{bestStreak !== 1 ? "s" : ""}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">winning days</p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className={statCardClass}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Hits
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-neon-green">
              {totalHits}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">correct picks</p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className={statCardClass}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Misses
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-bold-red">
              {totalPicks - totalHits}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">incorrect picks</p>
          </div>
        </StaggerItem>
      </StaggerChildren>

      {/* Main charts — 1 col mobile, 2 col md, 3 col lg */}
      {/* On lg: Players | Over+Trend stacked | Categories */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-3">
        <ScrollReveal>
          <PlayerHitRate data={players} />
        </ScrollReveal>
        <div className="flex h-full flex-col gap-3">
          <ScrollReveal className="flex-1">
            <DirectionSplit data={directions} />
          </ScrollReveal>
          <ScrollReveal className="flex-1">
            <TrendChart data={trend} />
          </ScrollReveal>
        </div>
        <ScrollReveal>
          <CategoryChart data={categories} />
        </ScrollReveal>
      </div>
      {/* On mobile/tablet: simple stacking */}
      <div className="grid gap-3 md:grid-cols-2 lg:hidden">
        <ScrollReveal>
          <PlayerHitRate data={players} />
        </ScrollReveal>
        <ScrollReveal>
          <DirectionSplit data={directions} />
        </ScrollReveal>
        <ScrollReveal>
          <TrendChart data={trend} />
        </ScrollReveal>
        <ScrollReveal className="md:col-span-2">
          <CategoryChart data={categories} />
        </ScrollReveal>
      </div>

      {/* Secondary charts — 3 columns, fill naturally */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {coinTrend.length >= 2 && (
          <ScrollReveal>
            <CoinTrendChart data={coinTrend} />
          </ScrollReveal>
        )}
        <ScrollReveal>
          <CardSizeChart data={cardSizes} />
        </ScrollReveal>
        {isAllMode && (
          <ScrollReveal>
            <GameModeStats data={gameModes} />
          </ScrollReveal>
        )}
        <ScrollReveal>
          <ScoreDistribution data={scoreDistributionData} />
        </ScrollReveal>
        <ScrollReveal>
          <TeamHitRate data={teams} />
        </ScrollReveal>
      </div>
    </div>
  );
}
