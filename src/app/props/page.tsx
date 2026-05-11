import { getCachedProps } from "@/lib/odds-api/cache";
import { type SportKey, SPORT_PRIORITY, SPORT_KEYS } from "@/lib/sports";
import { LOCK_BUFFER_MS } from "@/lib/challenges/constants";
import { fetchNcaabTeams } from "@/lib/stats-service/client";
import PropsPageClient from "@/components/props/PropsPageClient";
import NcaabTeamRegistrar from "@/components/props/NcaabTeamRegistrar";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { logWarn } from "@/lib/logger";

export const metadata = buildPageMetadata({
  title: "Browse Player Props",
  description:
    "Browse over/under prop bets on real player stats across NBA, college basketball, EPL, La Liga, and more. Free to play, no signup required.",
  path: "/props",
});

interface PropsPageProps {
  searchParams: Promise<{ sport?: string; category?: string; player?: string }>;
}

export default async function PropsPage({ searchParams }: PropsPageProps) {
  const { sport: rawSport, category, player } = await searchParams;

  let allGames: Awaited<ReturnType<typeof getCachedProps>> = null;
  try {
    allGames = await getCachedProps();
  } catch (error) {
    logWarn("props-page", "Failed to fetch props", error);
  }

  const now = Date.now();

  // Compute per-sport prop counts (pre-filter by LOCK_BUFFER_MS)
  const propCounts: Record<string, number> = {};
  for (const game of allGames ?? []) {
    if (new Date(game.commence_time).getTime() - now <= LOCK_BUFFER_MS) continue;
    if (game.props.length === 0) continue;
    propCounts[game.sport] = (propCounts[game.sport] ?? 0) + game.props.length;
  }

  // Determine initial sport
  let initialSport: SportKey;
  if ((SPORT_KEYS as readonly string[]).includes(rawSport as string)) {
    initialSport = rawSport as SportKey;
  } else {
    initialSport = SPORT_PRIORITY.find((s) => (propCounts[s] ?? 0) > 0) ?? "nba";
  }

  // Pre-filter server-side to reduce RSC payload: drop games past lock buffer
  // and games with 0 props. Client only needs to filter by sport/category/player.
  const clientGames = (allGames ?? [])
    .filter((g) => new Date(g.commence_time).getTime() - now > LOCK_BUFFER_MS)
    .filter((g) => g.props.length > 0) as (typeof allGames extends (infer T)[] | null ? T : never)[];

  // NCAAB logos require client-side team ID registration
  let ncaabTeams: Record<string, string> = {};
  if (propCounts["ncaab"]) {
    try {
      ncaabTeams = await fetchNcaabTeams();
    } catch (error) {
      logWarn("props-page", "ESPN unavailable for NCAAB teams", error);
    }
  }

  return (
    <>
      {Object.keys(ncaabTeams).length > 0 && <NcaabTeamRegistrar teams={ncaabTeams} />}
      <PropsPageClient
        allGames={clientGames}
        initialSport={initialSport}
        initialCategory={category}
        initialPlayer={player}
        propCounts={propCounts}
      />
    </>
  );
}
