import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, notFound, handleApiError } from "@/lib/api/errors";
import {
  fetchNbaGamesByDate,
  fetchSoccerGamesByDate,
  fetchLaLigaGamesByDate,
  fetchCopaDelReyGamesByDate,
  fetchNcaabGamesByDate,
  fetchSoccerFixtureById,
  type StatsGame,
} from "@/lib/stats-service/client";
import { teamsMatch } from "@/lib/team-matching";
import { lookbackDatesForSport } from "@/lib/sports/fetchers";
import { isSoccer } from "@/lib/sports/config";
import {
  resolveCard,
  persistResolution,
  handlePostResolution,
} from "@/lib/cards/resolution";
import { resolveEligibleChallenges } from "@/lib/challenges/resolution";
import { logError } from "@/lib/logger";
import type { Card, Pick, Prop, Game } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PickWithProp = Pick & {
  props: Prop & { games: Game & { sport?: string } };
};

type GameRow = {
  id: string;
  sport: string | null;
  commence_time: string | null;
  home_team: string;
  away_team: string;
  status: string | null;
  external_event_id: string | null;
};

// ---------------------------------------------------------------------------
// Sport → fetch function mapping
// ---------------------------------------------------------------------------

const SPORT_FETCHERS: Record<string, (date: string) => Promise<StatsGame[]>> = {
  nba: fetchNbaGamesByDate,
  epl: fetchSoccerGamesByDate,
  la_liga: fetchLaLigaGamesByDate,
  copa_del_rey: fetchCopaDelReyGamesByDate,
  ncaab: fetchNcaabGamesByDate,
};

function mapNbaStatus(status: string): "scheduled" | "live" | "final" {
  const s = status.toLowerCase();
  if (s.includes("final")) return "final";
  if (s.includes("live") || s.includes("progress") || s.includes("half"))
    return "live";
  return "scheduled";
}

// ---------------------------------------------------------------------------
// POST /api/admin/fix-card
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) return auth.response;

    const body = await request.json();
    const cardId = body?.cardId;
    if (!cardId || typeof cardId !== "string") {
      return badRequest("cardId is required");
    }

    const supabase = createAdminClient();

    // 1. Fetch card with picks → props → games
    const { data: card, error: cardErr } = await (supabase.from("cards") as any)
      .select("*, picks(*, props(*, games(*)))")
      .eq("id", cardId)
      .single();

    if (cardErr || !card) {
      return notFound("Card");
    }

    const typedCard = card as Card & { picks: PickWithProp[] };

    if (typedCard.status !== "locked") {
      return badRequest(`Card status is "${typedCard.status}", expected "locked"`);
    }

    // 2. Dedupe games by game_id
    const gamesById = new Map<string, GameRow>();
    for (const pick of typedCard.picks) {
      const game = pick.props?.games;
      if (game && !gamesById.has(game.id)) {
        gamesById.set(game.id, {
          id: game.id,
          sport: game.sport ?? null,
          commence_time: game.commence_time ?? null,
          home_team: game.home_team,
          away_team: game.away_team,
          status: game.status ?? null,
          external_event_id: game.external_event_id ?? null,
        });
      }
    }

    // 3. Re-fetch from stats service and update DB
    let gamesUpdated = 0;
    const debug: Record<string, unknown>[] = [];

    for (const [dbGameId, game] of gamesById) {
      const sport = game.sport ?? "nba";
      const fetcher = SPORT_FETCHERS[sport];
      if (!fetcher) {
        debug.push({ gameId: dbGameId, sport, error: "no fetcher for sport" });
        continue;
      }

      const commenceTime = game.commence_time
        ? new Date(game.commence_time)
        : new Date();
      const dates = lookbackDatesForSport(sport, commenceTime);

      const gameDebug: Record<string, unknown> = {
        gameId: dbGameId,
        sport,
        dbHome: game.home_team,
        dbAway: game.away_team,
        dbStatus: game.status,
        externalEventId: game.external_event_id,
        commenceTime: game.commence_time,
        lookbackDates: dates,
      };

      // For soccer games with an existing external_event_id, fetch the fixture
      // directly by ID. This bypasses by-date lookups which depend on the
      // season config being current.
      let matchedGame: StatsGame | null = null;
      const isSoccerSport = isSoccer(sport);

      if (isSoccerSport && game.external_event_id) {
        try {
          const fixture = await fetchSoccerFixtureById(game.external_event_id);
          if (fixture) {
            matchedGame = fixture;
            gameDebug.matchedVia = "fixture_by_id";
            gameDebug.matched = {
              home: fixture.home_team,
              away: fixture.away_team,
              status: fixture.status,
              score: `${fixture.home_score}-${fixture.away_score}`,
              gameId: fixture.game_id,
            };
          } else {
            gameDebug.fixtureByIdResult = "not found";
          }
        } catch (err) {
          gameDebug.fixtureByIdError = String(err);
        }
      }

      // Fallback: search by date + team matching
      if (!matchedGame) {
        for (const date of dates) {
          try {
            const liveGames = await fetcher(date);
            gameDebug[`apiGames_${date}`] = liveGames.map((lg) => ({
              home: lg.home_team,
              away: lg.away_team,
              status: lg.status,
              score: `${lg.home_score}-${lg.away_score}`,
            }));

            const found = liveGames.find(
              (lg) =>
                teamsMatch(game.home_team, lg.home_team) &&
                teamsMatch(game.away_team, lg.away_team)
            );
            if (found) {
              matchedGame = found;
              gameDebug.matchedVia = "date_lookup";
              gameDebug.matched = {
                home: found.home_team,
                away: found.away_team,
                status: found.status,
                score: `${found.home_score}-${found.away_score}`,
                gameId: found.game_id,
              };
              break;
            }
          } catch (err) {
            gameDebug[`fetchError_${date}`] = String(err);
            logError("fix-card", `Failed to fetch ${sport} games for date ${date}`, undefined, err);
          }
        }
      }

      if (!matchedGame) {
        gameDebug.result = "no match found";
        debug.push(gameDebug);
        continue;
      }

      // Map status for NBA/NCAAB (ESPN returns raw status strings)
      const newStatus = isSoccerSport
        ? (matchedGame.status as "scheduled" | "live" | "final")
        : mapNbaStatus(matchedGame.status);

      const { error: updateErr } = await (supabase.from("games") as any)
        .update({
          status: newStatus,
          home_score: matchedGame.home_score,
          away_score: matchedGame.away_score,
          external_event_id: matchedGame.game_id,
        })
        .eq("id", dbGameId);

      if (updateErr) {
        gameDebug.updateError = updateErr.message;
        logError("fix-card", `Failed to update game ${dbGameId}`, undefined, updateErr);
      } else {
        gameDebug.result = "updated";
        gamesUpdated++;
      }
      debug.push(gameDebug);
    }

    // 4. Re-fetch card with updated game data
    const { data: refreshedCard, error: refreshErr } = await (supabase.from("cards") as any)
      .select("*, picks(*, props(*, games(*)))")
      .eq("id", cardId)
      .single();

    if (refreshErr || !refreshedCard) {
      return NextResponse.json({ gamesUpdated, resolved: false, error: "Failed to re-fetch card", debug });
    }

    const refreshedTyped = refreshedCard as Card & { picks: PickWithProp[] };

    // 5. Check if all games are now final
    const allFinal = refreshedTyped.picks.every(
      (pick) => pick.props?.games?.status === "final"
    );

    if (!allFinal) {
      return NextResponse.json({ gamesUpdated, resolved: false, debug });
    }

    // 6. Resolve the card
    const boxscoreCache = new Map();
    const result = await resolveCard(refreshedTyped, boxscoreCache);

    if (!result) {
      return NextResponse.json({ gamesUpdated, resolved: false, debug });
    }

    const persisted = await persistResolution(supabase, result);
    if (!persisted) {
      return NextResponse.json({ gamesUpdated, resolved: false, error: "Card already resolved", debug });
    }

    if (result.total > 0) {
      await handlePostResolution(supabase, result);
    }

    // Resolve challenges if applicable
    try {
      await resolveEligibleChallenges();
    } catch (err) {
      logError("fix-card", "Failed to resolve challenges", undefined, err);
    }

    return NextResponse.json({
      gamesUpdated,
      resolved: true,
      score: result.score,
      total: result.total,
      debug,
    });
  } catch (err) {
    return handleApiError(err, "Failed to fix card");
  }
}
