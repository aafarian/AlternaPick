import { Suspense } from "react";
import { getCachedProps } from "@/lib/odds-api/cache";
import type { SportKey } from "@/lib/odds-api/constants";
import type { StatCategory } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/helpers";
import { getCategoryStats, getPlayerStats } from "@/lib/analytics/queries";
import type { EdgeMap } from "@/lib/analytics/types";
import { teamMatchesQuery } from "@/lib/constants";
import PropsHeader from "@/components/props/PropsHeader";
import SportSelector from "@/components/props/SportSelector";
import CategoryFilter from "@/components/props/CategoryFilter";
import PlayerSearch from "@/components/props/PlayerSearch";
import PropsGameList from "@/components/props/PropsGameList";
import { Card, CardContent } from "@/components/ui/card";

/** Minimum accuracy threshold (0-1) to qualify as an "edge" */
const EDGE_MIN_RATE = 0.65;
/** Minimum resolved picks to qualify as an "edge" */
const EDGE_MIN_TOTAL = 5;

interface PropsPageProps {
  searchParams: Promise<{ category?: string; player?: string; sport?: string }>;
}

export default async function PropsPage({ searchParams }: PropsPageProps) {
  const { category: rawCategory, player, sport: rawSport } = await searchParams;

  // Determine sport (default to NBA)
  const sport: SportKey = rawSport === "epl" ? "epl" : "nba";
  const defaultCategory = sport === "epl" ? "shots" : "points";
  const emptyEmoji = sport === "epl" ? "\u26BD" : "\uD83C\uDFC0";

  // Fetch props with a timeout so the page never hangs
  let games: Awaited<ReturnType<typeof getCachedProps>> = null;
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000));
    games = await Promise.race([getCachedProps(sport), timeout]);
  } catch {
    games = null;
  }

  // Build edge maps for authenticated users
  let categoryEdges: EdgeMap = {};
  let playerEdges: EdgeMap = {};

  try {
    const supabase = await createClient();
    const user = await getCurrentUser(supabase);

    if (user) {
      const [catStats, plrStats] = await Promise.all([
        getCategoryStats(supabase, user.id),
        getPlayerStats(supabase, user.id, 500),
      ]);

      for (const cs of catStats) {
        if (cs.total >= EDGE_MIN_TOTAL && cs.rate >= EDGE_MIN_RATE) {
          categoryEdges[cs.category] = cs.rate;
        }
      }
      for (const ps of plrStats) {
        if (ps.total >= EDGE_MIN_TOTAL && ps.rate >= EDGE_MIN_RATE) {
          playerEdges[ps.player_name] = ps.rate;
        }
      }
    }
  } catch {
    // If analytics fetch fails, continue without edge data
  }

  // Default category per sport when no category param; "all" shows everything
  const category = rawCategory ?? defaultCategory;
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
            p.player_name.toLowerCase().includes(playerQuery) ||
            teamMatchesQuery(p.player_team, playerQuery)
        )
        .sort((a, b) => a.player_name.localeCompare(b.player_name)),
    })) ?? [];

  const LOCK_BUFFER_MS = 5 * 60 * 1000;
  const now = Date.now();

  // Show all upcoming games (not just today) sorted by start time
  const withProps = filtered
    .filter((g) => g.props.length > 0)
    .filter(
      (g) => new Date(g.commence_time).getTime() - now > LOCK_BUFFER_MS
    );

  // Group games by date for section headers
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  type DateGroup = { label: string; games: typeof withProps };
  const dateGroups: DateGroup[] = [];

  const todayGames = withProps.filter((g) => {
    const t = new Date(g.commence_time).getTime();
    return t >= today.getTime() && t < tomorrow.getTime();
  });
  const tomorrowGames = withProps.filter((g) => {
    const t = new Date(g.commence_time).getTime();
    return t >= tomorrow.getTime() && t < dayAfter.getTime();
  });
  const laterGames = withProps.filter((g) => {
    const t = new Date(g.commence_time).getTime();
    return t >= dayAfter.getTime();
  });

  if (todayGames.length > 0) dateGroups.push({ label: "Tonight", games: todayGames });
  if (tomorrowGames.length > 0) {
    const label = `Tomorrow, ${tomorrow.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    dateGroups.push({ label, games: tomorrowGames });
  }
  if (laterGames.length > 0) {
    const label = dayAfter.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    dateGroups.push({ label, games: laterGames });
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <PropsHeader gameCount={withProps.length} dateLabel={dateGroups.length > 1 ? "Upcoming" : dateGroups[0]?.label} />

      <div className="sticky top-16 z-30 -mx-4 flex flex-col gap-3 bg-background px-4 pb-3 pt-2">
        <Suspense fallback={null}>
          <SportSelector />
        </Suspense>

        <Suspense fallback={null}>
          <PlayerSearch />
        </Suspense>

        <Suspense fallback={null}>
          <CategoryFilter sport={sport} />
        </Suspense>
      </div>

      {withProps.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
            <span className="text-5xl">{emptyEmoji}</span>
            {playerQuery || category ? (
              <>
                <h2 className="text-xl font-bold">No props found</h2>
                <p className="text-muted-foreground">
                  Try adjusting your search or filters.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold">No games available</h2>
                <p className="text-muted-foreground">
                  Check back later for upcoming player props!
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : dateGroups.length === 1 ? (
        <PropsGameList
          key={category}
          games={dateGroups[0].games}
          expandFirstOnly={isAll}
          categoryEdges={categoryEdges}
          playerEdges={playerEdges}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {dateGroups.map((group) => (
            <div key={group.label}>
              <h2 className="mb-3 text-lg font-bold text-muted-foreground">
                {group.label}
              </h2>
              <PropsGameList
                key={`${category}-${group.label}`}
                games={group.games}
                expandFirstOnly={isAll || group.label !== "Tonight"}
                categoryEdges={categoryEdges}
                playerEdges={playerEdges}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
