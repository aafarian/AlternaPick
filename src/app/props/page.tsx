import { Suspense } from "react";
import { getCachedProps } from "@/lib/odds-api/cache";
import type { StatCategory } from "@/lib/supabase/types";
import PropsHeader from "@/components/props/PropsHeader";
import CategoryFilter from "@/components/props/CategoryFilter";
import PlayerSearch from "@/components/props/PlayerSearch";
import PropsGameList from "@/components/props/PropsGameList";
import { Card, CardContent } from "@/components/ui/card";

interface PropsPageProps {
  searchParams: Promise<{ category?: string; player?: string }>;
}

export default async function PropsPage({ searchParams }: PropsPageProps) {
  const { category: rawCategory, player } = await searchParams;
  const games = await getCachedProps();

  // Default to "points" when no category param; "all" shows everything
  const category = rawCategory ?? "points";
  const isAll = category === "all";

  const playerQuery = player?.trim().toLowerCase() ?? "";

  const filtered =
    games?.map((game) => ({
      ...game,
      props: game.props
        .filter(
          (p) =>
            isAll || p.stat_category === (category as StatCategory)
        )
        .filter(
          (p) =>
            !playerQuery ||
            p.player_name.toLowerCase().includes(playerQuery)
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

      <div className="sticky top-16 z-30 -mx-4 flex flex-col gap-3 bg-background px-4 pb-3 pt-2">
        <Suspense fallback={null}>
          <PlayerSearch />
        </Suspense>

        <Suspense fallback={null}>
          <CategoryFilter />
        </Suspense>
      </div>

      {withProps.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
            <span className="text-5xl">🏀</span>
            {playerQuery || category ? (
              <>
                <h2 className="text-xl font-bold">No props found</h2>
                <p className="text-muted-foreground">
                  Try adjusting your search or filters.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold">No games tonight</h2>
                <p className="text-muted-foreground">
                  Check back on game day for player props!
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <PropsGameList key={category} games={withProps} expandFirstOnly={isAll} />
      )}
    </div>
  );
}
