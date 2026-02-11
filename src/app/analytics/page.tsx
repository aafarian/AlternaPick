import { createClient } from "@/lib/supabase/server";
import {
  getCategoryStats,
  getPlayerStats,
  getDirectionStats,
  getTrendData,
} from "@/lib/analytics/queries";
import CategoryChart from "@/components/analytics/CategoryChart";
import PlayerHitRate from "@/components/analytics/PlayerHitRate";
import DirectionSplit from "@/components/analytics/DirectionSplit";
import TrendChart from "@/components/analytics/TrendChart";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Analytics | Sports Tower",
  description: "Your prop pick analytics and hit rate breakdown.",
};

export default async function AnalyticsPage() {
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

  const [categories, players, directions, trend] = await Promise.all([
    getCategoryStats(supabase, user.id),
    getPlayerStats(supabase, user.id, 10),
    getDirectionStats(supabase, user.id),
    getTrendData(supabase, user.id, 30),
  ]);

  const totalPicks =
    categories.reduce((sum, c) => sum + c.total, 0);
  const totalHits =
    categories.reduce((sum, c) => sum + c.hits, 0);
  const overallRate = totalPicks > 0 ? Math.round((totalHits / totalPicks) * 100) : 0;

  const isEmpty = totalPicks === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Your prop pick performance breakdown
          </p>
        </div>
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-4xl">📊</span>
            <p className="text-lg font-semibold text-foreground">
              No data yet
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Play some games to see your analytics! Once your cards are
              resolved, your hit rates and trends will appear here.
            </p>
            <Link href="/props">
              <Button variant="default" size="sm" className="mt-2">
                Browse Props
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          {totalPicks} resolved pick{totalPicks !== 1 ? "s" : ""} &middot;{" "}
          {overallRate}% overall hit rate
        </p>
      </div>

      {/* Summary card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Total Picks
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                {totalPicks}
              </p>
            </div>
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

      {/* Charts grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryChart data={categories} />
        <PlayerHitRate data={players} />
        <DirectionSplit data={directions} />
        <TrendChart data={trend} />
      </div>
    </div>
  );
}
