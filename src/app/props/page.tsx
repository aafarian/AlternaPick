import { Suspense } from "react";
import { getCachedProps } from "@/lib/odds-api/cache";
import type { StatCategory } from "@/lib/supabase/types";
import GameCard from "@/components/props/GameCard";
import PropsHeader from "@/components/props/PropsHeader";
import CategoryFilter from "@/components/props/CategoryFilter";
import GameSelector from "@/components/props/GameSelector";
import { Card, CardContent } from "@/components/ui/card";

interface PropsPageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function PropsPage({ searchParams }: PropsPageProps) {
  const { category } = await searchParams;
  const games = await getCachedProps();

  const filtered =
    games?.map((game) => ({
      ...game,
      props: game.props
        .filter(
          (p) =>
            !category || p.stat_category === (category as StatCategory)
        )
        .sort((a, b) => a.player_name.localeCompare(b.player_name)),
    })) ?? [];

  const LOCK_BUFFER_MS = 5 * 60 * 1000;
  const now = Date.now();

  const withProps = filtered
    .filter((g) => g.props.length > 0)
    .filter(
      (g) => new Date(g.commence_time).getTime() - now > LOCK_BUFFER_MS
    );

  return (
    <div className="flex flex-col gap-6 py-8">
      <PropsHeader gameCount={withProps.length} />

      <div className="flex flex-col gap-3">
        <Suspense fallback={null}>
          <CategoryFilter />
        </Suspense>

        <GameSelector
          games={withProps.map((g) => ({
            id: g.id,
            away_team: g.away_team,
            home_team: g.home_team,
            commence_time: g.commence_time,
          }))}
        />
      </div>

      {withProps.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
            <span className="text-5xl">🏀</span>
            <h2 className="text-xl font-bold">No games tonight</h2>
            <p className="text-muted-foreground">
              Check back on game day for player props!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {withProps.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
