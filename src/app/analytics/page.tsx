import { createClient } from "@/lib/supabase/server";
import {
  getCategoryStats,
  getPlayerStats,
  getDirectionStats,
  getTrendData,
  getCardSizeStats,
  getTeamStats,
  getScoreDistribution,
  getGameModeStats,
} from "@/lib/analytics/queries";
import CategoryChart from "@/components/analytics/CategoryChart";
import PlayerHitRate from "@/components/analytics/PlayerHitRate";
import DirectionSplit from "@/components/analytics/DirectionSplit";
import TrendChart from "@/components/analytics/TrendChart";
import CardSizeChart from "@/components/analytics/CardSizeChart";
import TeamHitRate from "@/components/analytics/TeamHitRate";
import ScoreDistribution from "@/components/analytics/ScoreDistribution";
import GameModeStats from "@/components/analytics/GameModeStats";
import ModeFilter from "@/components/analytics/ModeFilter";
import SportFilter from "@/components/analytics/SportFilter";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isValidGameMode } from "@/lib/modes/definitions";
import { isValidSport, SPORT_CONFIG } from "@/lib/sports";
import type { GameMode } from "@/lib/supabase/types";
import { SlideUp, FadeIn, StaggerChildren, StaggerItem, ScrollReveal } from "@/components/motion";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";
import { BarChart3 } from "lucide-react";

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
    cardSizes,
    teams,
    scoreDistributionData,
    gameModes,
  ] = await Promise.all([
    getCategoryStats(supabase, user.id, mode, sport),
    getPlayerStats(supabase, user.id, 10, mode, sport),
    getDirectionStats(supabase, user.id, mode, sport),
    getTrendData(supabase, user.id, 30, mode, sport),
    getCardSizeStats(supabase, user.id, mode, sport),
    getTeamStats(supabase, user.id, 10, mode, sport),
    getScoreDistribution(supabase, user.id, mode, sport),
    getGameModeStats(supabase, user.id, sport),
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

  const sportLabel = sport !== "all" ? SPORT_CONFIG[sport].displayName : null;
  const hasFilters = mode !== "all" || sport !== "all";

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-6 py-8">
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

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <SlideUp>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          {totalPicks} resolved pick{totalPicks !== 1 ? "s" : ""}
          {sportLabel ? ` in ${sportLabel}` : ""} &middot;{" "}
          {overallRate}% overall hit rate
        </p>
      </SlideUp>

      {/* Mode Filter Tabs */}
      <FadeIn delay={0.1}>
        <ModeFilter activeMode={mode} availableModes={availableModes} currentSport={sport} />
      </FadeIn>
      <FadeIn delay={0.15}>
        <SportFilter activeSport={sport} currentMode={mode} />
      </FadeIn>

      {/* Overview Cards */}
      <StaggerChildren staggerDelay={0.08} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StaggerItem>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Total Cards
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                {totalCards}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
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
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Best Streak
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-amber-400">
                {bestStreak} day{bestStreak !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Total Picks
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                {totalPicks}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerChildren>

      {/* Summary stats row */}
      <FadeIn delay={0.35}>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Hits
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums text-neon-green">
                  {totalHits}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Misses
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums text-bold-red">
                  {totalPicks - totalHits}
                </p>
              </div>
              <div>
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
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Core Charts grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ScrollReveal>
          <CategoryChart data={categories} />
        </ScrollReveal>
        <ScrollReveal>
          <PlayerHitRate data={players} />
        </ScrollReveal>
        <ScrollReveal>
          <DirectionSplit data={directions} />
        </ScrollReveal>
        <ScrollReveal>
          <TrendChart data={trend} />
        </ScrollReveal>
      </div>

      {/* Advanced Analytics Section */}
      <FadeIn delay={0.1}>
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Advanced Analytics
        </h2>
        <p className="text-sm text-muted-foreground">
          Deeper insights into your prop picking patterns
        </p>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-2">
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
