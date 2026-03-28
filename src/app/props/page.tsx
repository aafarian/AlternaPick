import { Suspense } from "react";
import { getCachedProps, getCachedPropCounts } from "@/lib/odds-api/cache";
import type { StatCategory } from "@/lib/supabase/types";
import { teamMatchesQuery } from "@/lib/constants";
import { fetchNcaabTeams } from "@/lib/stats-service/client";
import { type SportKey, SPORT_PRIORITY, SPORT_KEYS, SPORT_CONFIG } from "@/lib/sports";
import { LOCK_BUFFER_MS } from "@/lib/challenges/constants";
import PropsHeader from "@/components/props/PropsHeader";
import SportSelector from "@/components/props/SportSelector";
import CategoryFilter from "@/components/props/CategoryFilter";
import PlayerSearch from "@/components/props/PlayerSearch";
import PropsGameList from "@/components/props/PropsGameList";
import NcaabTeamRegistrar from "@/components/props/NcaabTeamRegistrar";
import { SlideUp, FadeIn } from "@/components/motion";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";
import { logWarn } from "@/lib/logger";

interface PropsPageProps {
  searchParams: Promise<{ category?: string; player?: string; sport?: string }>;
}

export default async function PropsPage({ searchParams }: PropsPageProps) {
  const { category: rawCategory, player, sport: rawSport } = await searchParams;

  // Fetch prop counts first so we can pick the best default sport
  let propCounts: Record<string, number> = {};
  try {
    propCounts = await getCachedPropCounts();
  } catch (error) {
    logWarn("props-page", "Failed to fetch prop counts, using empty defaults", error);
  }

  // Determine sport: use URL param if set, otherwise pick the first sport with props
  let sport: SportKey;
  if ((SPORT_KEYS as readonly string[]).includes(rawSport as string)) {
    sport = rawSport as SportKey;
  } else {
    sport = SPORT_PRIORITY.find((s) => (propCounts[s] ?? 0) > 0) ?? "nba";
  }
  const emptyEmoji = SPORT_CONFIG[sport].icon;

  // Fetch props for the selected sport
  let games: Awaited<ReturnType<typeof getCachedProps>> = null;
  try {
    games = await getCachedProps(sport);
  } catch (error) {
    logWarn("props-page", `Failed to fetch props for ${sport}`, error);
    games = null;
  }

  // Fetch NCAAB team ESPN IDs for client-side logo rendering
  // (RSC and client components use separate module instances, so we pass via props)
  let ncaabTeams: Record<string, string> = {};
  if (sport === "ncaab") {
    try {
      ncaabTeams = await fetchNcaabTeams();
    } catch (error) {
      logWarn("props-page", "ESPN unavailable for NCAAB teams, falling back to tricode text", error);
    }
  }

  // Default to "all" when no category param
  const category = rawCategory ?? "all";
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
            teamMatchesQuery(p.player_team, playerQuery) ||
            game.home_team.toLowerCase().includes(playerQuery) ||
            game.away_team.toLowerCase().includes(playerQuery)
        )
        .sort((a, b) => a.player_name.localeCompare(b.player_name)),
    })) ?? [];

  const now = Date.now();

  // Show all upcoming games (not just today) sorted by start time
  const withProps = filtered
    .filter((g) => g.props.length > 0)
    .filter(
      (g) => new Date(g.commence_time).getTime() - now > LOCK_BUFFER_MS
    );

  return (
    <div className="flex flex-col gap-6 py-8">
      {sport === "ncaab" && Object.keys(ncaabTeams).length > 0 && (
        <NcaabTeamRegistrar teams={ncaabTeams} />
      )}
      <SlideUp>
        <PropsHeader gameCount={withProps.length} />
      </SlideUp>

      <div className="sticky top-16 z-30 -mx-4 flex flex-col gap-3 overflow-x-hidden border-b border-border bg-background px-4 pb-3 pt-2 shadow-sm">
        <FadeIn delay={0.1}>
          <Suspense fallback={null}>
            <SportSelector counts={propCounts} activeSport={sport} />
          </Suspense>
        </FadeIn>

        <FadeIn delay={0.15}>
          <Suspense fallback={null}>
            <PlayerSearch />
          </Suspense>
        </FadeIn>

        <FadeIn delay={0.2}>
          <Suspense fallback={null}>
            <CategoryFilter sport={sport} />
          </Suspense>
        </FadeIn>
      </div>

      {withProps.length === 0 ? (
        <AnimatedEmptyState
          icon={emptyEmoji}
          title={playerQuery || !isAll ? "No props found" : "No games available"}
          description={
            playerQuery || !isAll
              ? "Try adjusting your search or filters."
              : "Check back later for upcoming player props!"
          }
        />
      ) : (
        <FadeIn delay={0.25}>
        <PropsGameList
          key={`${sport}-${category}`}
          games={withProps}
        />
        </FadeIn>
      )}
    </div>
  );
}
