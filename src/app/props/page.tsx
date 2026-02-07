import { Suspense } from "react";
import { getCachedProps } from "@/lib/odds-api/cache";
import type { StatCategory } from "@/lib/supabase/types";
import GameCard from "@/components/props/GameCard";
import PropsHeader from "@/components/props/PropsHeader";
import CategoryFilter from "@/components/props/CategoryFilter";

interface PropsPageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function PropsPage({ searchParams }: PropsPageProps) {
  const { category } = await searchParams;
  const games = await getCachedProps();

  // Filter by category if specified
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

  const withProps = filtered.filter((g) => g.props.length > 0);

  return (
    <div className="flex flex-col gap-6 py-8">
      <PropsHeader gameCount={withProps.length} />

      <Suspense fallback={null}>
        <CategoryFilter />
      </Suspense>

      {withProps.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface py-20 text-center">
          <span className="text-4xl">🏀</span>
          <h2 className="text-xl font-semibold">No games tonight</h2>
          <p className="text-muted">
            Check back on game day for player props!
          </p>
        </div>
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
