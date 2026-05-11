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
import AnalyticsPageClient from "@/components/analytics/AnalyticsPageClient";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isValidGameMode } from "@/lib/modes/definitions";
import { isValidSport } from "@/lib/sports";
import type { GameMode } from "@/lib/supabase/types";

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

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">Sign in to view your analytics.</p>
        <Link href="/auth/login">
          <Button variant="default" size="sm">Sign In</Button>
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

  // Determine which modes the user has data for
  const availableModes: GameMode[] = ["classic"];
  for (const gm of gameModes) {
    if (gm.cards > 0 && gm.mode !== "classic") {
      availableModes.push(gm.mode);
    }
  }

  return (
    <AnalyticsPageClient
      initialData={{
        categories,
        players,
        directions,
        trend,
        coinTrend,
        cardSizes,
        teams,
        scoreDistribution: scoreDistributionData,
        gameModes,
        cardHistory,
      }}
      initialMode={mode}
      initialSport={sport}
      availableModes={availableModes}
    />
  );
}
