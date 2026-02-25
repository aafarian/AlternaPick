import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchTodaysGames, fetchNbaGamesByDate, fetchSoccerGames, fetchLaLigaGames, fetchNcaabGames, fetchNcaabGamesByDate } from "@/lib/stats-service/client";
import { resolveEligibleCards, reResolveStaleCards } from "@/lib/cards/resolution";
import { resolveEligibleChallenges } from "@/lib/challenges/resolution";
import { unauthorized, serverError, handleApiError } from "@/lib/api/errors";
import { registerNcaabTeamIds } from "@/lib/constants";
import type { Game } from "@/lib/supabase/types";
import { logError } from "@/lib/logger";

// Map NBA.com tricodes to Odds API full team names
const TRICODE_TO_TEAM: Record<string, string> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAC: "Los Angeles Clippers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
};

function normalizeTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bst\.\s*/g, "state ")   // "St." → "State"
    .replace(/\bst\b/g, "state")       // "St" (no period, word boundary) → "State"
    .replace(/\bmt\.\s*/g, "mount ")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function teamsMatch(dbTeam: string, liveTeam: string): boolean {
  if (dbTeam === liveTeam) return true;
  const a = normalizeTeam(dbTeam);
  const b = normalizeTeam(liveTeam);
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}

function mapNbaStatus(status: string): "scheduled" | "live" | "final" {
  const s = status.toLowerCase();
  if (s.includes("final")) return "final";
  if (s.includes("live") || s.includes("progress") || s.includes("half"))
    return "live";
  return "scheduled";
}

export async function POST(request: NextRequest) {
  // Auth check
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${syncSecret}`) {
      return unauthorized();
    }
  }

  try {
    const supabase = createAdminClient();
    const now = new Date();

    // Step 0: Force-finalize stale games (started > 6 hours ago, still not "final" in DB).
    // This catches games from previous days that were never synced to "final",
    // whether they were stuck at "live" or "scheduled".
    const staleThreshold = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    let staleFinalizedCount = 0;

    const staleResult = await (supabase.from("games") as any)
      .select("id")
      .neq("status", "final")
      .not("external_event_id", "is", null)  // Only finalize games with external event ID
      .lt("commence_time", staleThreshold.toISOString());

    const staleGames = ((staleResult.data ?? []) as { id: string }[]);
    if (staleGames.length > 0) {
      const staleIds = staleGames.map((g) => g.id);
      const { error: staleError } = await (supabase.from("games") as any)
        .update({ status: "final" })
        .in("id", staleIds);

      if (!staleError) {
        staleFinalizedCount = staleIds.length;
      }
    }

    const nbaGames = await fetchTodaysGames();

    // Get today's games from Supabase
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(now);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const updated: { odds_team: string; nba_team: string; status: string; external_event_id: string }[] = [];
    const gamesBecameLive: string[] = [];

    if (nbaGames.length > 0) {
      const gamesResult = await supabase
        .from("games")
        .select("*")
        .eq("sport", "nba")
        .gte("commence_time", todayStart.toISOString())
        .lte("commence_time", tomorrowEnd.toISOString());

      if (gamesResult.error) {
        return serverError("Failed to fetch games from DB", gamesResult.error.message);
      }

      const games = (gamesResult.data ?? []) as Game[];

      for (const nbaGame of nbaGames) {
        const homeTeamFull = TRICODE_TO_TEAM[nbaGame.home_tricode];
        const awayTeamFull = TRICODE_TO_TEAM[nbaGame.away_tricode];

        // Find matching DB game by team names
        const match = games.find((g) => {
          const homeMatch =
            g.home_team === homeTeamFull ||
            g.home_team.includes(nbaGame.home_team) ||
            nbaGame.home_team.includes(g.home_team.split(" ").pop() ?? "");
          const awayMatch =
            g.away_team === awayTeamFull ||
            g.away_team.includes(nbaGame.away_team) ||
            nbaGame.away_team.includes(g.away_team.split(" ").pop() ?? "");
          return homeMatch && awayMatch;
        });

        if (!match) continue;

        const newStatus = mapNbaStatus(nbaGame.status);
        const previousStatus = match.status;

        const { error: updateError } = await (supabase.from("games") as any)
          .update({
            status: newStatus,
            home_score: nbaGame.home_score,
            away_score: nbaGame.away_score,
            external_event_id: nbaGame.game_id,
          })
          .eq("id", match.id);

        if (!updateError) {
          updated.push({
            odds_team: `${match.away_team} @ ${match.home_team}`,
            nba_team: `${nbaGame.away_team} @ ${nbaGame.home_team}`,
            status: newStatus,
            external_event_id: nbaGame.game_id,
          });

          if (newStatus === "live" && previousStatus === "scheduled") {
            gamesBecameLive.push(match.id);
          }
        }
      }
    }

    // --- NBA lookback: fix old event IDs from the nba_api → ESPN migration ---
    // Matches recent NBA games by team names and overwrites stale external_event_ids.
    try {
      const nbaLookbackStart = new Date(now);
      nbaLookbackStart.setDate(nbaLookbackStart.getDate() - 7);

      const nbaStaleResult = await supabase
        .from("games")
        .select("*")
        .eq("sport", "nba")
        .gte("commence_time", nbaLookbackStart.toISOString())
        .lt("commence_time", todayStart.toISOString()); // exclude today (already handled above)

      const nbaStaleGames = (nbaStaleResult.data ?? []) as Game[];
      // Only process games that have no ESPN-format event ID
      const nbaUnmatched = nbaStaleGames.filter(
        (g) => !g.external_event_id || !g.external_event_id.startsWith("401")
      );

      if (nbaUnmatched.length > 0) {
        const datesToFetch = new Set<string>();
        for (const g of nbaUnmatched) {
          if (g.commence_time) {
            const d = new Date(g.commence_time);
            datesToFetch.add(d.toISOString().slice(0, 10).replace(/-/g, ""));
            // Also check day before for UTC boundary edge cases
            const dayBefore = new Date(d);
            dayBefore.setDate(dayBefore.getDate() - 1);
            datesToFetch.add(dayBefore.toISOString().slice(0, 10).replace(/-/g, ""));
          }
        }

        const allEspnNbaGames = (
          await Promise.all(
            Array.from(datesToFetch).map((dateStr) =>
              fetchNbaGamesByDate(dateStr).catch(() => [])
            )
          )
        ).flat();

        for (const espnGame of allEspnNbaGames) {
          const homeTeamFull = TRICODE_TO_TEAM[espnGame.home_tricode];
          const awayTeamFull = TRICODE_TO_TEAM[espnGame.away_tricode];

          const match = nbaUnmatched.find((g) => {
            // Skip already-matched games
            if ((g as any)._matched) return false;
            const homeMatch =
              g.home_team === homeTeamFull ||
              teamsMatch(g.home_team, espnGame.home_team);
            const awayMatch =
              g.away_team === awayTeamFull ||
              teamsMatch(g.away_team, espnGame.away_team);
            return homeMatch && awayMatch;
          });

          if (!match) continue;

          const newStatus = mapNbaStatus(espnGame.status);

          const { error: updateError } = await (supabase.from("games") as any)
            .update({
              status: newStatus,
              home_score: espnGame.home_score,
              away_score: espnGame.away_score,
              external_event_id: espnGame.game_id,
            })
            .eq("id", match.id);

          if (!updateError) {
            (match as any)._matched = true;
            updated.push({
              odds_team: `${match.away_team} @ ${match.home_team}`,
              nba_team: `${espnGame.away_team} @ ${espnGame.home_team}`,
              status: newStatus,
              external_event_id: espnGame.game_id,
            });
          }
        }
      }
    } catch (nbaLookbackError) {
      logError("game-sync", `Failed NBA lookback: ${nbaLookbackError instanceof Error ? nbaLookbackError.message : nbaLookbackError}`, "/api/games/sync-status");
    }

    // --- Soccer (EPL) game sync ---
    try {
      const soccerGames = await fetchSoccerGames();

      if (soccerGames.length > 0) {
        const eplGamesResult = await supabase
          .from("games")
          .select("*")
          .eq("sport", "epl")
          .gte("commence_time", todayStart.toISOString())
          .lte("commence_time", tomorrowEnd.toISOString());

        const eplDbGames = (eplGamesResult.data ?? []) as Game[];

        for (const soccerGame of soccerGames) {
          const match = eplDbGames.find((g) =>
            teamsMatch(g.home_team, soccerGame.home_team) &&
            teamsMatch(g.away_team, soccerGame.away_team)
          );

          if (!match) continue;

          const newStatus = soccerGame.status as "scheduled" | "live" | "final";
          const previousStatus = match.status;

          const { error: updateError } = await (supabase.from("games") as any)
            .update({
              status: newStatus,
              home_score: soccerGame.home_score,
              away_score: soccerGame.away_score,
              external_event_id: soccerGame.game_id,
            })
            .eq("id", match.id);

          if (!updateError) {
            updated.push({
              odds_team: `${match.away_team} @ ${match.home_team}`,
              nba_team: `${soccerGame.away_team} @ ${soccerGame.home_team}`,
              status: newStatus,
              external_event_id: soccerGame.game_id,
            });

            if (newStatus === "live" && previousStatus === "scheduled") {
              gamesBecameLive.push(match.id);
            }
          }
        }
      }
    } catch (soccerError) {
      logError("game-sync", `Failed to sync EPL games: ${soccerError instanceof Error ? soccerError.message : soccerError}`, "/api/games/sync-status");
    }

    // --- La Liga game sync ---
    try {
      const laLigaGames = await fetchLaLigaGames();

      if (laLigaGames.length > 0) {
        const laLigaGamesResult = await supabase
          .from("games")
          .select("*")
          .eq("sport", "la_liga")
          .gte("commence_time", todayStart.toISOString())
          .lte("commence_time", tomorrowEnd.toISOString());

        const laLigaDbGames = (laLigaGamesResult.data ?? []) as Game[];

        for (const laLigaGame of laLigaGames) {
          const match = laLigaDbGames.find((g) =>
            teamsMatch(g.home_team, laLigaGame.home_team) &&
            teamsMatch(g.away_team, laLigaGame.away_team)
          );

          if (!match) continue;

          const newStatus = laLigaGame.status as "scheduled" | "live" | "final";
          const previousStatus = match.status;

          const { error: updateError } = await (supabase.from("games") as any)
            .update({
              status: newStatus,
              home_score: laLigaGame.home_score,
              away_score: laLigaGame.away_score,
              external_event_id: laLigaGame.game_id,
            })
            .eq("id", match.id);

          if (!updateError) {
            updated.push({
              odds_team: `${match.away_team} @ ${match.home_team}`,
              nba_team: `${laLigaGame.away_team} @ ${laLigaGame.home_team}`,
              status: newStatus,
              external_event_id: laLigaGame.game_id,
            });

            if (newStatus === "live" && previousStatus === "scheduled") {
              gamesBecameLive.push(match.id);
            }
          }
        }
      }
    } catch (laLigaError) {
      logError("game-sync", `Failed to sync La Liga games: ${laLigaError instanceof Error ? laLigaError.message : laLigaError}`, "/api/games/sync-status");
    }

    // --- NCAAB game sync ---
    try {
      const ncaabGames = await fetchNcaabGames();

      // Register ESPN team IDs for logo rendering
      registerNcaabTeamIds(
        ncaabGames.flatMap((g) => [
          { name: g.home_team, id: g.home_team_id ?? "" },
          { name: g.away_team, id: g.away_team_id ?? "" },
        ])
      );

      if (ncaabGames.length > 0) {
        const ncaabGamesResult = await supabase
          .from("games")
          .select("*")
          .eq("sport", "ncaab")
          .gte("commence_time", todayStart.toISOString())
          .lte("commence_time", tomorrowEnd.toISOString());

        const ncaabDbGames = (ncaabGamesResult.data ?? []) as Game[];

        for (const ncaabGame of ncaabGames) {
          const match = ncaabDbGames.find((g) =>
            teamsMatch(g.home_team, ncaabGame.home_team) &&
            teamsMatch(g.away_team, ncaabGame.away_team)
          );

          if (!match) continue;

          const newStatus = ncaabGame.status as "scheduled" | "live" | "final";
          const previousStatus = match.status;

          const { error: updateError } = await (supabase.from("games") as any)
            .update({
              status: newStatus,
              home_score: ncaabGame.home_score,
              away_score: ncaabGame.away_score,
              external_event_id: ncaabGame.game_id,
            })
            .eq("id", match.id);

          if (!updateError) {
            updated.push({
              odds_team: `${match.away_team} @ ${match.home_team}`,
              nba_team: `${ncaabGame.away_team} @ ${ncaabGame.home_team}`,
              status: newStatus,
              external_event_id: ncaabGame.game_id,
            });

            if (newStatus === "live" && previousStatus === "scheduled") {
              gamesBecameLive.push(match.id);
            }
          }
        }
      }

      // Check for unmatched NCAAB games in the last 7 days.
      // This catches games that were missed due to team name mismatches,
      // UTC date boundary issues, or sync downtime.
      const lookbackStart = new Date(now);
      lookbackStart.setDate(lookbackStart.getDate() - 7);

      const unmatchedResult = await supabase
        .from("games")
        .select("*")
        .eq("sport", "ncaab")
        .is("external_event_id", null)
        .gte("commence_time", lookbackStart.toISOString());

      const unmatchedGames = (unmatchedResult.data ?? []) as Game[];

      if (unmatchedGames.length > 0) {
        // Collect unique ESPN dates to fetch (game date + day before for UTC boundary)
        const datesToFetch = new Set<string>();
        for (const g of unmatchedGames) {
          if (g.commence_time) {
            const d = new Date(g.commence_time);
            datesToFetch.add(d.toISOString().slice(0, 10).replace(/-/g, ""));
            const dayBefore = new Date(d);
            dayBefore.setDate(dayBefore.getDate() - 1);
            datesToFetch.add(dayBefore.toISOString().slice(0, 10).replace(/-/g, ""));
          }
        }

        // Fetch ESPN games for all needed dates in parallel
        const allEspnGames = (
          await Promise.all(
            Array.from(datesToFetch).map((dateStr) =>
              fetchNcaabGamesByDate(dateStr).catch(() => [])
            )
          )
        ).flat();

        for (const ncaabGame of allEspnGames) {
          const match = unmatchedGames.find((g) =>
            !g.external_event_id &&
            teamsMatch(g.home_team, ncaabGame.home_team) &&
            teamsMatch(g.away_team, ncaabGame.away_team)
          );

          if (!match) continue;

          const newStatus = ncaabGame.status as "scheduled" | "live" | "final";
          const previousStatus = match.status;

          const { error: updateError } = await (supabase.from("games") as any)
            .update({
              status: newStatus,
              home_score: ncaabGame.home_score,
              away_score: ncaabGame.away_score,
              external_event_id: ncaabGame.game_id,
            })
            .eq("id", match.id);

          if (!updateError) {
            // Mark the game as matched so it's not re-matched
            (match as any).external_event_id = ncaabGame.game_id;

            updated.push({
              odds_team: `${match.away_team} @ ${match.home_team}`,
              nba_team: `${ncaabGame.away_team} @ ${ncaabGame.home_team}`,
              status: newStatus,
              external_event_id: ncaabGame.game_id,
            });

            if (newStatus === "live" && previousStatus === "scheduled") {
              gamesBecameLive.push(match.id);
            }
          }
        }
      }
    } catch (ncaabError) {
      logError("game-sync", `Failed to sync NCAAB games: ${ncaabError instanceof Error ? ncaabError.message : ncaabError}`, "/api/games/sync-status");
    }

    // Auto-cancel accepted challenges where only one side locked a card
    // and any of that card's games just went live (prevents peeking at live picks)
    let challengesCancelled = 0;

    if (gamesBecameLive.length > 0) {
      try {
        const acceptedResult = await (supabase.from("challenges") as any)
          .select("id")
          .eq("status", "accepted");

        const acceptedChallenges = (acceptedResult.data ?? []) as { id: string }[];

        for (const challenge of acceptedChallenges) {
          const cardsForChallenge = await (supabase.from("cards") as any)
            .select("id, picks(props(game_id))")
            .eq("challenge_id", challenge.id)
            .eq("status", "locked");

          const cards = (cardsForChallenge.data ?? []) as {
            id: string;
            picks: { props: { game_id: string } | null }[];
          }[];

          if (cards.length !== 1) continue;

          const hasLiveGame = cards[0].picks.some(
            (p) => p.props?.game_id && gamesBecameLive.includes(p.props.game_id)
          );

          if (hasLiveGame) {
            const { error: cancelError } = await (supabase.from("challenges") as any)
              .update({ status: "cancelled" })
              .eq("id", challenge.id);

            if (!cancelError) {
              challengesCancelled += 1;
            }
          }
        }
      } catch (cancelError) {
        logError("resolution", `Failed to cancel stale challenges: ${cancelError instanceof Error ? cancelError.message : cancelError}`, "/api/games/sync-status");
      }
    }

    // Always attempt resolution — these functions are idempotent and skip
    // when nothing qualifies. Running unconditionally ensures cards/challenges
    // that missed a previous cycle (timing, team name mismatch) still resolve.
    let cardsResolved = 0;
    let challengesResolved = 0;
    let reResolved = { picksUpdated: 0, cardsRescored: 0 };

    try {
      const cardResults = await resolveEligibleCards();
      cardsResolved = cardResults.length;

      const challengeResults = await resolveEligibleChallenges();
      challengesResolved = challengeResults.length;
    } catch (resolveError) {
      logError("resolution", `Auto-resolution error: ${resolveError instanceof Error ? resolveError.message : resolveError}`, "/api/games/sync-status");
    }

    // Re-resolve stale picks (null actual_value on already-resolved cards).
    // This fixes cards that were resolved before boxscore/ESPN ID was available.
    try {
      reResolved = await reResolveStaleCards();
    } catch (reResolveError) {
      logError("resolution", `Re-resolution of stale picks failed: ${reResolveError instanceof Error ? reResolveError.message : reResolveError}`, "/api/games/sync-status");
    }

    return NextResponse.json({
      updated: updated.length,
      games: updated,
      stale_finalized: staleFinalizedCount,
      challenges_cancelled: challengesCancelled,
      cards_resolved: cardsResolved,
      challenges_resolved: challengesResolved,
      picks_re_resolved: reResolved.picksUpdated,
      cards_rescored: reResolved.cardsRescored,
    });
  } catch (error) {
    return handleApiError(error, "Failed to sync game statuses");
  }
}
